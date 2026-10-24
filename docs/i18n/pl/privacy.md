# Polityka prywatności

*Ostatnia aktualizacja: 23 października 2026*

**Tworzenie w Lolly odbywa się na Twoim urządzeniu.** Otwieranie narzędzia, pisanie, podgląd, eksport i sprawdzanie pliku działają w aplikacji na telefonie, komputerze lub w przeglądarce. Nie potrzebujesz konta, a aplikacja nie ustawia przy tym żadnych plików cookie.

**To, co tworzysz, opuszcza urządzenie tylko wtedy, gdy o to poprosisz.** Dodanie czcionki Google, wysłanie pliku na Dysk lub do Dropboxa, włączenie synchronizacji (Sync), odtwarzanie radia albo pobranie modelu AI działającego na urządzeniu - każda z tych czynności wysyła żądanie, które sam inicjujesz. Aplikacja pobiera też swoje narzędzia i aktualizacje z własnego adresu, a te żądania nie zawierają niczego, co stworzyłeś. [Każde żądanie sieciowe, jakie może wysłać aplikacja](#every-network-request-the-app-can-make) wymienia je host po hoście.

**Kilka usług Lolly działa na serwerze.** Linki renderujące, pobieranie obrazów, punkt końcowy dla agentów AI i usługa zweryfikowanej tożsamości otrzymują tylko to, co im wyślesz, i przechowują to nie dłużej, niż podaje ta strona.

**Instancja Lolly Work Twojej organizacji jest inna.** Przechowuje wspólną pracę, którą w niej umieścisz, a do tych danych stosuje się polityka jej operatora, nie ta.

::: figure privacy-where-data-goes
Dokąd trafiają Twoje dane: zostają na urządzeniu, dopóki nie wyślesz żądania, a każdy rodzaj żądania ma własne miejsce docelowe.
:::

## Co obejmuje ta polityka

Lolly to oprogramowanie open source, które może uruchomić każdy: silnik, powłoki aplikacji dla przeglądarki, komputera, urządzeń mobilnych i terminala oraz rozszerzenie przeglądarki. Ta polityka ma dwie części:

- <!--i:code--> **Samo oprogramowanie**: co robi, a czego nie robi z Twoimi danymi, niezależnie od tego, gdzie działa. To cecha kodu, więc dotyczy każdego wdrożenia Lolly, naszego i cudzego.
- <!--i:server--> **lolly.tools**, wdrożenie referencyjne prowadzone przez SUSE: decyzje podjęte przy obsłudze jego opcjonalnych elementów serwerowych, takie jak co jest logowane, jak długo i przez kogo.

W samodzielnie hostowanej lub firmowej instancji Lolly opisane poniżej zachowanie oprogramowania nadal obowiązuje, ale za wszystko na serwerach odpowiada *operator* tej instancji, nie SUSE: jego punkt końcowy renderowania, serwer MCP, usługę certyfikatów i instancję Lolly Work. Poproś go o jego własną politykę. [Adoption & Governance](/info/adoption-governance.html) opisuje, co oznacza prowadzenie Lolly.

## Co zostaje na Twoim urządzeniu

Aplikacje internetowa, komputerowa i mobilna Lolly uruchamiają cały silnik renderowania na urządzeniu. Gdy używane narzędzia, zasoby i kodery są już na urządzeniu, renderowanie i pobieranie nie wymagają serwera.

**Samodzielne korzystanie z aplikacji nie ustawia plików cookie.** Logowanie do organizacji i opcjonalna rejestracja zweryfikowanej tożsamości mają własne pliki cookie, opisane w ich sekcjach. Aplikacja przechowuje na urządzeniu te dane:

- <!--i:sliders--> **Preferencje interfejsu**: motyw, język, ustawienia dźwięku, rozmiary paneli bocznych i powiększenia, wybory sortowania i widoku oraz informacje o tym, które wskazówki już widziałeś, w `localStorage`, aby były gotowe, zanim aplikacja skończy się uruchamiać.
- <!--i:download--> **Pamięć podręczna katalogu narzędzi i podglądów zasobów w trybie offline**, aby galeria działała bez połączenia.
- <!--i:hash--> **Lokalne liczniki użycia** do statystyk na karcie profilu, takich jak liczba eksportów i użyte narzędzia: mały, ograniczony zapis w `localStorage`, którego nigdy nie czytamy i który nigdzie nie jest wysyłany.
- <!--i:folder--> **Twoja własna praca**: dokumenty, zapisane sesje i ich historia, wgrane obrazy i czcionki, wyniki plików i wcześniejsze wersje oraz Kosz, który przechowuje usunięte elementy przez 30 dni. Znajdują się w IndexedDB na urządzeniu i tam zostają, chyba że wybierzesz synchronizację lub udostępnianie.
- <!--i:globe--> **Wyszukiwanie miast w Meeting Planner**, w `localStorage`, aby każde miasto było wyszukiwane tylko raz.
- <!--i:cpu--> **Pobrane modele i przypięte narzędzia**: modele AI działające na urządzeniu, na których pobranie się zgodziłeś, oraz narzędzia przypięte do użytku offline.

**Settings → Storage** pokazuje, ile miejsca zajmuje Lolly na urządzeniu, z osobnym wykazem Twojej pracy, Kosza, pobranych modeli, kopii offline i pamięci podręcznych. **Clear all my data** usuwa tam lokalną kopię i najpierw wyłącza synchronizację; to samo robi wyczyszczenie danych witryny w przeglądarce. Przechowywanie ściśle niezbędne do usługi, o którą prosisz, nie wymaga zgody na gruncie dyrektywy o prywatności i łączności elektronicznej (ePrivacy Directive, art. 5 ust. 3), a jedynie przejrzystości, którą zapewnia ten dokument i komunikat w aplikacji.

![Sekcja Storage w Settings na ekranie o szerokości telefonu: nazwana każda kategoria danych na urządzeniu, a przy liście przycisk Clear all my data](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

**Export my data** tworzy plik `lolly-backup`, który przechowujesz i kontrolujesz sam. Nigdy nie trafia na nasze serwery, chyba że sam go gdzieś wyślesz. Zobacz [Data transfer](/info/data-transfer.html).

### Narzędzia działające na Twoim urządzeniu

Niektóre narzędzia, takie jak **Strip Hidden Data**, **Compress** i inne z odznaką **Runs on your device**, pracują na pliku, który im podasz. Plik jest wczytywany do pamięci, przekształcany na urządzeniu i oddawany z powrotem jako pobranie. Nigdy nie jest wysyłany, bo na jego drodze nie ma serwera. Te narzędzia działają offline, a ich wynik nie zawiera naszego znaku wodnego ani metadanych.

**Rondocode** to jedyny wyjątek, bo tworzy nowe audio z Twojej piosenki, zamiast przekształcać Twój plik. Każdy zapisany przez niego plik audio zawiera Content Credentials, które rejestrują piosenkę i deklarują ewentualny śpiew wygenerowany przez AI. Panel eksportu informuje o tym przed eksportem, a [Rondocode songs](/info/rondocode.html#files-from-the-rondocode-utility) wymienia dokładnie, co jest zapisywane.

![Odznaka tych narzędzi: Runs on your device - nothing is uploaded](/t/url-shot?url=%2F%23%2Ftool%2Ftext-helper&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%5Bdata-privacy%5D&dark=1&filename=pv-ondevice-badge)

**Prepare for sharing** i **Compare** działają w pamięci urządzenia i nic nie wysyłają na serwer, a Prepare nie dodaje niczego do historii, linków, kopii zapasowych ani synchronizacji, dopóki nie zapiszesz wyniku.

::: details Jak Prepare for sharing i Compare obsługują Twoje pliki
**Prepare for sharing** przechowuje robocze dane wejściowe, prywatne ustalenia i mapy zamian w pamięci, bez dodawania ich do historii, linków, kopii zapasowych ani synchronizacji. Kontrola i zamiana nie wysyłają zawartości plików na serwer i nie sprawdzają poświadczeń online. To Ty decydujesz, czy skopiować, pobrać, wysłać lub zapisać wynik w bibliotece; zapisany wynik podlega potem ustawieniom kopii zapasowej i synchronizacji Twojej biblioteki. Pliki receptur pomijają wcześniejszą zawartość i dosłowne mapowania, a raporty podsumowujące zawierają liczby, identyfikatory zakresów i skróty plików. CLI zapisuje prywatny plik przeglądu z oryginalnymi wartościami tylko na prośbę, przez `--review-file`. Opuszczenie widoku przygotowania zwalnia jego stan roboczy, co nie jest obietnicą kryminalistycznego wymazania z pamięci przeglądarki ani systemu operacyjnego.

Przygotowane kopie i zakończone operacje na plikach korzystają z tych samych kontrolek Compare. Usunięte wartości są domyślnie zwinięte, a raporty porównania pomijają nazwy źródeł, ścieżki i wartości, chyba że zdecydujesz się je dołączyć. Historia plików zapisuje kopię, więc porównanie po ponownym wczytaniu wymaga ponownego wskazania oryginału, dopasowanego po zapisanym SHA-256. Wskazanie go nie zapisuje ani nie wysyła pliku.
:::

Strip Hidden Data i Prepare for sharing sprawdzają też na urządzeniu pliki DOCX, PPTX i XLSX. W obsługiwanych plikach DOCX wybrane właściwości można usunąć w nowej kopii; pozostała zawartość Office jest tylko do kontroli, a prywatne podglądy pozostają za kontrolką odsłaniania.

::: details Co odczytuje i usuwa kontrola plików Office
| Format Office | Kontrolowana zawartość pakietu | Obsługiwane usuwanie |
|---|---|---|
| DOCX | Właściwości podstawowe, aplikacji i niestandardowe; komentarze i autorzy; znaczniki zmian śledzonych i podglądy; ukryte fragmenty tekstu; relacje zewnętrzne; obiekty osadzone | Wybrane: autor, ostatnio zapisał, daty utworzenia/modyfikacji/ostatniego wydruku, tytuł, temat, opis, słowa kluczowe, właściwości niestandardowe, Company, Manager, Template, podstawa hiperłączy, nazwa i wersja aplikacji oraz statystyki (całkowity czas edycji oraz liczba stron, słów, znaków, wierszy i akapitów) |
| PPTX | Właściwości; komentarze i rekordy autorów; notatki prelegenta; znaczniki ukrytych slajdów; relacje zewnętrzne; obiekty osadzone i obsługiwane zagnieżdżone skoroszyty | Brak |
| XLSX | Właściwości; komentarze i notatki; znaczniki ukrytych arkuszy, wierszy i kolumn; nazwy zdefiniowane; relacje zewnętrzne i połączenia; powierzchnie łączy zewnętrznych i pamięci podręcznej tabel przestawnych; obiekty osadzone | Brak |

**Limity.** Spis nie sprawdza w pełni widocznego tekstu, formuł, zależności, wyglądu po renderowaniu ani dowolnych części binarnych. Obsługuje do 300 części pakietu, 64 MiB łącznego zadeklarowanego rozpakowania, 2 MiB na część XML i dwa poziomy zagnieżdżonych pakietów osadzonych; Prepare dzieli budżety części i rozpakowania na całe zadanie. Obcięta, uszkodzona, zaszyfrowana i nieobsługiwana zawartość jest zgłaszana i zachowywana. Zawartość makr jest rozpoznawana i nigdy nie uruchamiana, starsze binarne formaty Office i XLSB nie są kontrolowane, a odwołania zewnętrzne nigdy nie są pobierane.

**Co zachowuje czyszczenie DOCX.** Czyszczenie obsługuje przejściowy format pakietu DOCX z kanonicznymi częściami właściwości podstawowych, niestandardowych i rozszerzonych. Z właściwości rozszerzonych można usunąć Company, Manager, Template, HyperlinkBase, Application, AppVersion oraz statystyki TotalTime, Pages, Words, Characters, CharactersWithSpaces, Lines i Paragraphs. DocSecurity, tytuły nagłówków i części, flagi łączy oraz inne właściwości aplikacji są zachowywane. Usunięcie Template pozostawia ewentualne dołączone łącze do szablonu w ustawieniach dokumentu, gdzie spis zgłasza je jako relację zewnętrzną.

Niektóre programy wybierają sposób rysowania wykresów i rysunków na podstawie nazwy i wersji aplikacji; LibreOffice na przykład pokazuje wykres z pliku Word 2007 inaczej bez nich. Obie wartości są zachowywane, gdy plik zawiera wykresy, obrazy, kształty lub obiekty osadzone, a kontrola wymienia je jako zachowane. Właściwość pokazywana przez pole Word (TEMPLATE, EDITTIME, NUMPAGES, NUMWORDS lub NUMCHARS) jest zachowywana, a pola łączy i względne łącza zewnętrzne zachowują HyperlinkBase, ponieważ ich cele są rozwiązywane względem tego adresu bazowego.

**Co pozostaje tylko do kontroli.** Rozszerzone dane podpisu cyfrowego uniemożliwiają czyszczenie. Podpisane, z makrami, zaszyfrowane, uszkodzone, zmienione nazwą lub zagnieżdżone pakiety Office pozostają tylko do kontroli. Dotyczy to także plików z innymi polami Word zależnymi od właściwości, takimi jak DOCPROPERTY lub AUTHOR, albo z kontrolkami zawartości powiązanymi z XML, ponieważ usunięcie właściwości mogłoby zmienić dokument, gdy Word zaktualizuje te powiązania, a zapisany w pamięci podręcznej tekst pola nie pokaże, że następne renderowanie będzie wyglądać tak samo. Części XML z nietypowymi rozszerzeniami nazw plików, cele relacji XML Worda, których nie da się bezpiecznie sprawdzić, błędnie zadeklarowane części nagłówka lub stopki oraz części SVG zadeklarowane jako XML z rozszerzeniem `.svg` również pozostają w tej pierwszej wersji czyszczenia tylko do kontroli.

**Jak czyszczenie sprawdza swoją pracę.** Części właściwości, ich deklaracje, niepowiązane elementy pakietu, komentarze XML i komentarze ZIP są zachowywane. Czyszczenie stosuje limity spisu i przed zapisem sprawdza integralność każdego elementu, a następnie ponownie kontroluje powstałe właściwości. Compare pokazuje obsługiwane różnice właściwości ze zwiniętymi wartościami; nie porównuje widocznego tekstu ani wyglądu po renderowaniu. Wartości używają podglądów do 2048 znaków, więc różnice poza podglądem mogą się nie pokazać, a częściowy przegląd nie może wykazać, że dwa pliki są równe. Polecenie CLI `prepare --strip-hidden-data` usuwa obsługiwane właściwości DOCX, a prywatna koperta przeglądu może wybrać pojedyncze z nich. Nieudana zapora czyszczenia zachowuje plik i zgłasza nieudaną operację.
:::

## Każde żądanie sieciowe, jakie może wykonać aplikacja

Większość żądań dostarcza na Twoje urządzenie narzędzia, czcionki lub modele. Akcje wysyłania przesyłają wybrany przez Ciebie plik, Sync przesyła kopię zapasową do wybranego przez Ciebie magazynu, a usługi organizacji przesyłają treść lub dane potrzebne do wspólnej pracy. Każda poniższa grupa podaje, co opuszcza urządzenie, kiedy i co się dzieje, gdy operator zablokuje żądanie. Skonfigurowani przez operatora dostawcy tożsamości i zasobów mogą dodać miejsca docelowe w jego wdrożeniu. [Każdy stały host w jednej tabeli](#every-fixed-host-in-one-table) wymienia hosty, z którymi może się łączyć aplikacja internetowa.

::: details Rzeczy pobierane na Twoje urządzenie
- <!--i:download--> **Katalog narzędzi.** Nic osobistego: żądanie publicznego indeksu narzędzi i zasobów Lolly do własnego adresu aplikacji, przy starcie, a potem pamięć podręczna offline. Po zablokowaniu aplikacja działa na zapamiętanych narzędziach i przestaje odkrywać nowe.
- <!--i:sparkle--> **Zestawy emoji.** Wybrany zestaw pobiera się z własnego adresu aplikacji przy pierwszym jego użyciu. Nie jest wysyłane nic osobistego. Animacje Lottie są odczytywane na urządzeniu i z nikim się nie łączą.
- <!--i:document--> **Google Fonts.** Nazwa wybranej rodziny i Twój adres IP trafiają do serwerów czcionek Google (`fonts.googleapis.com` dla arkusza stylów, `fonts.gstatic.com` dla pliku czcionki). Dzieje się to tylko wtedy, gdy dodasz czcionkę Google w Design System Setup, i dopiero po tym, jak w oknie dialogowym zgodzisz się na dokładnie to. Każda rodzina jest pobierana raz, potem przechowywana na urządzeniu i używana offline. Po zablokowaniu selektor kończy się niepowodzeniem bez przepuszczania ruchu; wgraj zamiast tego plik czcionki.
- <!--i:cpu--> **Modele AI działające na urządzeniu.** Nic osobistego: pobranie pliku modelu, a potem przechowywanie na urządzeniu. Wersje webowe domyślnie używają własnego adresu aplikacji; kompilacja może wskazać inny host modeli, na przykład host wydań Lolly `lolli.li` dla aplikacji pakietowych. Host otrzymuje żądanie i Twój adres IP, bez konta i bez danych wejściowych modelu. Dzieje się to tylko wtedy, gdy używasz funkcji wymagającej modelu (głębokie skanowanie Verify, powiększanie obrazów, mowa i podobne) albo wybierzesz pobranie modeli do użytku offline. Po zablokowaniu ta funkcja czeka, a wszystko inne działa.
- <!--i:sliders--> **Profile ICC do druku.** Nic osobistego: żądanie standardowego profilu warunków druku do publicznego rejestru ICC (`registry.color.org`, `www.color.org`), tylko po kliknięciu ustawienia ICC w menedżerze profili druku, raz na profil. Po zablokowaniu ustawienia nie działają; podaj własny profil `.icc`.
- <!--i:globe--> **Radio internetowe.** Nic osobistego: żądanie listy odtwarzania i strumień audio ze stacji (`api.somafm.com` i serwer strumienia, na który wskazuje, `*.somafm.com`), tylko gdy odtwarzasz opcjonalne radio w odtwarzaczu dźwięku. Po zablokowaniu radio nie działa, a każda inna funkcja dźwięku działa.
:::

::: details Narzędzie, które potrzebuje danych na żywo
- <!--i:globe--> **Wyszukiwanie miast w Meeting Planner.** Obecnie to jedyne narzędzie pobierające dane na żywo. Prosi `geocoding-api.open-meteo.com` o zamianę każdej nazwy miasta (miasta gospodarza i miasta każdego członka zespołu) na współrzędne i strefę czasową, bez konta, bez klucza i bez identyfikatora poza samym żądaniem. Pole Host city to wyjaśnia, a każda odpowiedź jest zapisywana na urządzeniu, więc miasto jest wyszukiwane raz. Działa tylko wtedy, gdy narzędzie jest otwarte. Po zablokowaniu wyszukiwanie zawodzi i nic innego nie jest dotknięte.
:::

::: details Pliki, które wysyłasz
Każda z tych opcji wysyła tylko jeden wybrany przez Ciebie plik, po naciśnięciu jej przycisku Send, po zalogowaniu w oknie samej usługi. Hasło aplikacji Bluesky, adres webhooka Discorda, hasło aplikacji Nextcloud i klucze S3 są przechowywane wyłącznie na tym urządzeniu, nigdy w kopii zapasowej, a **Disconnect** je usuwa.

- <!--i:upload--> **Google Drive.** Plik, w dowolnym formacie, trafia do API Dysku Google (`www.googleapis.com`). Dostęp Lolly jest ograniczony do plików, które sam utworzył (zakres `drive.file`), więc nigdy nie może czytać reszty Twojego Dysku. W aplikacji internetowej token logowania jest przechowywany w pamięci na czas sesji i nigdy nie jest zapisywany; w innych aplikacjach token odświeżania jest zapisywany tylko na tym urządzeniu, jeśli zaznaczysz **Stay connected**. Przycisk istnieje tylko w kompilacjach, w których operator skonfigurował identyfikator klienta Google. Po zablokowaniu przycisk się nie pojawia; pobierz plik i wgraj go samodzielnie.
- <!--i:upload--> **Dropbox.** Plik trafia do API Dropboxa (`api.dropboxapi.com` dla logowania i metadanych, `content.dropboxapi.com` dla pliku). Dostęp dotyczy tylko folderu aplikacji, więc Lolly widzi `Apps/` i własny folder w nim, i nic więcej. Pokazywany link **Open** jest krótkotrwałym linkiem prywatnym i nie powstaje żadne publiczne udostępnienie. Token odświeżania jest zapisywany tylko wtedy, gdy zaznaczysz **Stay connected**. Przycisk istnieje tylko przy skonfigurowanym przez operatora identyfikatorze klienta Dropbox.
- <!--i:upload--> **OneDrive.** Plik trafia do usług tożsamości i Graph firmy Microsoft (`login.microsoftonline.com` dla logowania, `graph.microsoft.com` dla wysyłania); duży plik jest wysyłany w częściach do `api.onedrive.com` lub źródeł magazynu skonfigurowanych przez operatora. Dostęp jest ograniczony do własnego folderu Lolly w `Apps/`, plus Twoja nazwa wyświetlana na etykietę konta. Token odświeżania jest zapisywany tylko wtedy, gdy zaznaczysz **Stay connected**. Przycisk istnieje tylko przy skonfigurowanym przez operatora identyfikatorze klienta Microsoft.
- <!--i:upload--> **LinkedIn**, **tylko w aplikacjach komputerowych**. Plik, z jego nazwą jako tekstem wpisu, trafia do LinkedIn (`www.linkedin.com` dla logowania w Twojej własnej przeglądarce, `api.linkedin.com` dla wysyłania i wpisu) jako publiczny wpis na Twojej osi. Lolly może publikować jako Ty i odczytać Twoje imię i nazwisko na etykietę konta, nic więcej. Logowanie jest zapamiętywane tylko wtedy, gdy zaznaczysz **Stay connected**, a tokeny LinkedIn ważne są 60 dni i nie można ich odnowić po cichu, więc wygasa samo. Tych hostów nie ma w polityce połączeń aplikacji internetowej. Przycisk istnieje tylko w kompilacjach ze skonfigurowaną aplikacją LinkedIn.
- <!--i:upload--> **Penpot.** Twój osobisty token dostępu Penpot, który wklejasz do aplikacji, oraz archiwum `.penpot` projektu trafiają do API Penpot (`design.penpot.app`) przez małe przekazywanie pod własnym adresem aplikacji (`/api/penpot`), ponieważ API Penpot nie odpowie bezpośrednio przeglądarce. Przekazywanie przekazuje i zapomina; aplikacje komputerowe łączą się z Penpot bezpośrednio. Dzieje się to tylko wtedy, gdy naciśniesz **Send to Penpot** w narzędziu Design i potwierdzisz projekt. Po zablokowaniu wysyłanie kończy się niepowodzeniem bez przepuszczania ruchu; wyeksportuj plik `.penpot` i zaimportuj go samodzielnie.
- <!--i:upload--> **Bluesky.** Obraz, jego nazwa jako tekst wpisu i tekst alternatywny oraz Twój uchwyt i hasło aplikacji (utworzone w Bluesky → Settings → App passwords, nigdy hasło do konta) trafiają na wskazany przez Ciebie serwer Bluesky, domyślnie `bsky.social`. Najpierw łączysz konto w **Settings → Connected services**.
- <!--i:upload--> **Discord.** Plik trafia jako załącznik na adres webhooka kanału, który wkleiłeś, na discord.com. Każdy, kto ma adres webhooka, może pisać na ten kanał, dlatego pozostaje on na urządzeniu.
- <!--i:upload--> **Mastodon.** Plik, z jego nazwą jako tekstem wpisu, trafia na wskazany przez Ciebie serwer Mastodon lub zgodny, po zalogowaniu w oknie tego serwera. Łączenie rejestruje na tym serwerze małą aplikację dla tego urządzenia, a logowanie jest zapamiętywane tylko wtedy, gdy zaznaczysz **Stay connected**.
- <!--i:upload--> **Nextcloud lub WebDAV.** Plik trafia na Twój własny serwer w jednym uwierzytelnionym przesłaniu, z adresem serwera, nazwą użytkownika i hasłem aplikacji, które wpisałeś (Nextcloud → Settings → Security → Devices & sessions; nigdy hasło do konta).
- <!--i:upload--> **Magazyn zgodny z S3.** Plik trafia do Twojego własnego bucketu (AWS S3, MinIO, R2, B2, Garage lub dowolny punkt końcowy SigV4), podpisany na urządzeniu wpisaną przez Ciebie parą kluczy.

**Hosty, które wybierasz, wymagają zgody operatora.** Hostów Bluesky, Discord, Mastodon, Nextcloud i S3 nie ma na stałej liście Lolly, bo wybierasz je sam. Aplikacja nic do nich nie wysyła, dopóki operator nie zatwierdzi dokładnie tego hosta HTTPS: w sieci - w polityce Content Security Policy wdrożenia; w aplikacjach komputerowych - przy budowaniu aplikacji. To samo dotyczy niestandardowych hostów magazynu i wysyłania do SharePoint. W sieci serwer musi też zezwalać na wywołania z przeglądarki z aplikacji (CORS), a przekierowanie kończy się niepowodzeniem bez przepuszczania ruchu, więc używaj adresu, który nie przekierowuje. Aplikacje komputerowe sprawdzają każde przekierowanie względem zatwierdzonej listy.

Ta lista ogranicza, do których hostów aplikacja może dotrzeć. Nie rozróżnia kont ani dzierżawców u Google lub Microsoft, a o tym, które konta i działania są dozwolone, decydują uprawnienia samego dostawcy. Nie obejmuje też okien logowania, innych typów zasobów ani funkcji natywnych, które mają własne zasady. Zmiana wymaga nowej kompilacji komputerowej lub nowych nagłówków odpowiedzi w sieci; zapisz pracę, zanim ponownie otworzysz aplikację, aby ją pobrać. [Connector origins](/info/connector-origins.html) opisuje konfigurację.
:::

::: details Synchronizacja między urządzeniami
- <!--i:folder--> **Co opuszcza urządzenie.** Kopia tego, co stworzyłeś na tym urządzeniu (zapisane sesje i projekty, Twoje systemy projektowe z czcionkami i logo, wgrane obrazy, profil i preferencje) jako jeden plik, do jedynego wybranego przez Ciebie magazynu: folder aplikacji Lolly w Twoim Dropboxie (`api.dropboxapi.com`, `content.dropboxapi.com`), pliki utworzone przez Lolly na Twoim Dysku Google (`www.googleapis.com`), folder aplikacji Lolly w Twoim OneDrive (`graph.microsoft.com`, a większe pliki są wysyłane do `api.onedrive.com` lub źródeł magazynu skonfigurowanych przez operatora, pobierane zaś z dokładnych źródeł magazynu skonfigurowanych przez operatora) albo Twój własny Nextcloud, serwer WebDAV lub bucket S3. Ten sam magazyn przechowuje do siedmiu kopii dziennych i jedną kopię sprzed ostatniego zastosowania.
- <!--i:shieldcheck--> **Nic nie trafia do Lolly.** Na drodze nie ma żadnego serwera Lolly, przekaźnika ani serwera Lolly Work, a aplikacje nie potrzebują do tego żadnej witryny Lolly, nawet do logowania. Kopia jest szyfrowana na urządzeniu najpierw tylko wtedy, gdy ustawisz hasło. Logowania, klucze, hasła aplikacji, hasło i ustawienia synchronizacji zostają na urządzeniu i nigdy nie trafiają do kopii. W sieci zapamiętane połączenie z Dyskiem Google zachowuje tylko nazwę konta (oraz Twój własny identyfikator klienta, jeśli go podałeś), a logowanie Google trwa jedną wizytę. W aplikacji na Androida logowanie do Dysku Google przechodzi przez usługi Google Play na telefonie, które prowadzi Google.
- <!--i:sliders--> **Kiedy.** Dopiero po włączeniu **Sync across my devices** lub naciśnięciu **Sync now**: wysłanie wkrótce po każdej zmianie i przy opuszczaniu aplikacji oraz sprawdzenie nowszej kopii przy uruchomieniu aplikacji. Po zablokowaniu synchronizacja kończy się niepowodzeniem i podaje przyczynę, a Twoja praca zostaje na urządzeniu. Możesz zamiast tego wyeksportować dane do pliku i przenieść je samodzielnie. [Sync your devices](/info/sync.html) opisuje tę funkcję.
:::

::: details Strony internetowe, przechwycone widoki i obrazy z innych witryn
- <!--i:monitor--> **Adres URL, który każesz narzędziu przechwycić.** Narzędzie URL screenshot żąda dokładnie tego adresu, który wpiszesz, tylko gdy rozpoczniesz przechwytywanie. Ponieważ adres wybierasz w tym momencie, nie ma go w polityce połączeń, a operator nie może go dopuścić ani zablokować według hosta; aby go usunąć, usuń narzędzie.
- <!--i:globe--> **Strona internetowa w boksie Design.** Strona jest pobierana wraz z Twoim adresem IP z witryny, z której pochodzi, razem ze wszystkim, czego sama zażąda. Tam, gdzie przeglądarka to obsługuje, ramka nie otrzymuje plików cookie ani żadnego adresu poza własnym źródłem aplikacji, więc Twój dokument i jego link nigdy nie podróżują z żądaniem. W aplikacji internetowej można osadzać w ramkach tylko te odtwarzacze: `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com` (mapy) i `www.figma.com`, a także strony referencyjne w `wikipedia.org` i `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org` i `www.openstreetmap.org`. **Allow pages from any site** w **Settings → Trusted sites** ponownie ładuje Lolly na Twoim urządzeniu z polityką, która pozwala osadzić dowolną stronę `https:`, a nadal obowiązują te same zasady zaufania i pytania. Strona ładuje się tylko dla witryny z Twoich Trusted sites, w tym usuwalnych domyślnych źródeł referencyjnych, albo po zatwierdzeniu tego boksu w jego inspektorze; do tego czasu otrzymana od kogoś prezentacja pokazuje obraz każdej strony. Przed prezentacją lista oferuje dla każdej witryny **Just this time** i **Always trust**, a w trakcie prezentacji o nic nie jesteś pytany. Po zablokowaniu boks pokazuje swój obraz z linkiem otwierającym stronę w nowej karcie. Narzędzia Lolly i dema Sandbox w boksie działają pod własnym adresem aplikacji i z nikim się nie łączą.
- <!--i:sliders--> **Zmiana pokazywanej strony.** Akcja **Use page** boksu strony internetowej pozwala odrzucić pliki cookie lub zamknąć baner wewnątrz strony. Na dostępnych stronach Lolly **Hide cookie banners** ukrywa znane nakładki, w tym OneTrust, bez akceptowania plików cookie i bez zmiany wyboru zgody witryny. **Page CSS** zmienia działającą stronę i prezentację tego boksu; eksporty nadal używają wybranego plakatu. Reguły nie mogą importować zasobów ani czcionek, a przeglądarki nie pozwalają Lolly zmieniać CSS innej witryny. Podglądy Sandbox mają własny edytor CSS w **Edit in Sandbox**.
- <!--i:code--> **Zasoby webowe dema Sandbox.** Każdy arkusz stylów, skrypt, czcionka lub obraz, do którego linkuje kod dema, jest pobierany wraz z Twoim adresem IP i bez plików cookie z witryny, która je hostuje; pliki wskazane przez pobrany arkusz stylów, takie jak pliki czcionek Google Fonts, liczą się jako osobne witryny. Dzieje się to tylko po kliknięciu **Fetch & inline** albo dla witryny z Twoich Trusted sites; **Always trust** przy pliku dodaje jego witrynę do tej listy. Po zablokowaniu demo działa bez tych plików, a Sandbox wymienia każdy plik, którego nie udało się pobrać, i przyczynę.
- <!--i:download--> **Dodanie obrazu z adresu URL.** **Add from URL** w selektorze zasobów lub w Assets żąda dokładnie wklejonego adresu obrazu. Własna polityka aplikacji internetowej uniemożliwia przeglądarce pobranie obrazu bezpośrednio z innej witryny, więc małe przekazywanie pod własnym adresem aplikacji (`/api/fetch-image`) pobiera obraz i oddaje tylko bajty; niczego nie przechowuje, zapomina adres i odrzuca wszystko, co nie jest publicznym adresem obrazu. Aplikacje komputerowe pobierają adres bezpośrednio. Wklejony link Lolly nie jest w ogóle pobierany: renderuje się na urządzeniu. Jeśli operator wyłączy przekazywanie (`LOLLY_DISABLE_IMAGE_PROXY=1`), w aplikacji internetowej można dodawać tylko linki Lolly, obrazy `data:` i obrazy z tego samego źródła, a aplikacje komputerowe nie są dotknięte.
- <!--i:palette--> **System projektowy ze strony internetowej.** Design System Setup może odczytać jedną stronę wskazanej witryny przez [rozszerzenie przeglądarki](#the-browser-extension) lub własne pobieranie aplikacji komputerowej, nigdy przez serwer Lolly. Nic nie jest pobierane, zanim naciśniesz, a linki na stronie nie są śledzone.
:::

::: details Praca z innymi ludźmi i agentami
- <!--i:link--> **Prywatna współpraca (collab).** Dwa urządzenia łączą się bezpośrednio, bez serwera pośrodku. Zaproszenie i odpowiedź zawierają adresy, które każde urządzenie widzi we własnej sieci, a ta kompilacja nie konfiguruje żadnego zewnętrznego serwera wykrywania adresów, więc przekaż je tylko osobie, z którą pracujesz. Zobacz [Working together](/info/collaborate.html).
- <!--i:monitor--> **Nearby** w aplikacji komputerowej. Gdy jesteś widoczny, czyli przez dziesięć minut od rozpoczęcia zaproszenia do współpracy lub, jeśli to włączysz, zawsze gdy aplikacja działa, aplikacja ogłasza w sieci lokalnej losową nazwę, wybraną przez Ciebie nazwę wyświetlaną i rodzaj urządzenia. Nie ogłasza adresu e-mail, konta ani trwałego identyfikatora.
- <!--i:link--> **Invite an agent.** Stan zaproszonego dokumentu, podglądy, o które prosi agent, tożsamość agenta i jego zmiany przechodzą przez skonfigurowany przekaźnik na żywo (`lolly.ing` na lolly.tools) do zapraszanego agenta. Zainstalowana wtyczka hostowana przekazuje też wywołania przez łącznik lolly.tools do przekaźnika wybranego przez zaproszenie; łącznik nie przechowuje zaproszenia ani dokumentu między wywołaniami. Przekaźnik trzyma zaproszenia i oczekujące żądania w pamięci, dopóki się nie rozłączysz lub nie wygasną: dziesięć minut dla niewykorzystanego zaproszenia i trzydzieści minut bez aktywności dla dołączonego. Dostawca Twojego agenta przetwarza otrzymane dane zgodnie z własną polityką. Dzieje się to tylko po utworzeniu zaproszenia w Share i przekazaniu jego instrukcji agentowi; dostęp do odczytu pozwala na przeglądanie, a dostęp do edycji pozwala także na zmiany. Pause zatrzymuje zmiany, a Disconnect lub unieważnienie zaproszenia kończy dostęp. Po zablokowaniu agent nie może dołączyć ani kontynuować, a Ty nadal edytujesz.
- <!--i:cpu--> **Allow AI control** w aplikacji komputerowej. Agent działający na tym komputerze może czytać i edytować otwarty dokument Design przez połączenie, które pozostaje na komputerze. Jest wyłączone, dopóki go nie włączysz. Lolly nic w tym celu nie wysyła na serwer; dostawca agenta przetwarza to, co agent czyta, zgodnie z własną polityką. [Threat Model & Trust Boundaries](/info/threat-model.html) wymienia, co taki agent może, a czego nie może.
- <!--i:server--> **Zdalna instancja.** Gdy skierujesz aplikację do innego wdrożenia Lolly, otrzymuje ona wszystko, co ta instancja zwraca przez tę samą synchronizację katalogu, a do żądań do niej dodawany jest znacznik wersji (rodzaj aplikacji i wersja silnika, te same informacje, które niesie user agent), aby jej operator widział, które wersje Lolly są używane. W instancji zarządzanej, gdy jesteś zalogowany, znacznik niesie też identyfikator instalacji tego urządzenia, aby lista urządzeń operatora odróżniała instalacje; wylogowanie usuwa identyfikator, a urządzenie, które połączy się później, przedstawia nowy. Hosta wybierasz Ty, więc nie ma go w polityce połączeń. Po zablokowaniu przełączenie kończy się niepowodzeniem, a Twoja lokalna instancja pozostaje nietknięta.
- <!--i:people--> **Instancja Lolly Work Twojej organizacji.** Tożsamość logowania i informacje o urządzeniu, żądania polityk, wspólne sesje, edycje współpracy, wysyłane pliki, zgłoszenia do zatwierdzenia i pliki dostarczenia, z których korzystasz, oraz dozwolone etykiety zdarzeń użycia tam, gdzie skonfigurowano, trafiają do instancji Twojej organizacji, a logowanie odbywa się przez jej dostawcę tożsamości. Odświeżanie polityk i włączona telemetria mogą działać podczas użytkowania; wspólna praca, collaby, przegląd i dostarczanie wysyłają treść w ramach tych przepływów. Po zablokowaniu te funkcje organizacji nie mogą się zakończyć, a Twoja osobista praca pozostaje oddzielna. Zobacz [Usługi organizacji z Lolly Work](#organisation-services-with-lolly-work).
:::

### Każdy stały host w jednej tabeli

Content Security Policy aplikacji internetowej powstrzymuje skrypt przed dotarciem do jakiegokolwiek hosta, którego nie wymienia. Poza własnym adresem aplikacji tabela podaje każdy host z tej polityki oraz dwa hosty LinkedIn dodawane przez aplikacje komputerowe, oznaczone jako tylko dla komputera. Test CI porównuje tę tabelę z wdrożoną polityką, więc host nie może zostać dodany do jednej bez drugiej.

| Co | Co faktycznie opuszcza Twoje urządzenie | Hosty |
|---|---|---|
| Modele na urządzeniu w aplikacjach pakietowych i pliki wydań | Żądanie publicznego pliku wraz z Twoim adresem IP | `lolli.li` |
| Google Fonts | Nazwa rodziny czcionek i Twój adres IP | `fonts.googleapis.com`, `fonts.gstatic.com` |
| Send to i Sync z Google Drive | Wybrany plik lub kopia zapasowa | `www.googleapis.com` |
| Send to i Sync z Dropbox | Wybrany plik lub kopia zapasowa | `api.dropboxapi.com`, `content.dropboxapi.com` |
| Send to i Sync z OneDrive | Wybrany plik lub kopia zapasowa oraz Twoja nazwa wyświetlana na etykietę konta | `login.microsoftonline.com`, `graph.microsoft.com`, `api.onedrive.com` |
| Wyszukiwanie miast w Meeting Planner | Każda nazwa miasta | `geocoding-api.open-meteo.com` |
| Profile ICC do druku | Żądanie publicznego profilu | `registry.color.org`, `www.color.org` |
| Radio internetowe | Żądanie listy odtwarzania i strumień audio | `api.somafm.com`, `*.somafm.com` |
| Invite an agent i przestrzeń robocza lolly.ing | Stan zaproszonego dokumentu, podglądy i zmiany oraz żądania przestrzeni roboczej, które wysyłasz | `lolly.ing` |
| Odtwarzacze w boksie webowym Design | Żądanie strony wraz z Twoim adresem IP | `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com`, `www.figma.com` |
| Strony referencyjne w boksie webowym Design | Żądanie strony wraz z Twoim adresem IP | `wikipedia.org`, `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org`, `www.openstreetmap.org` |
| Send to LinkedIn, tylko w aplikacjach komputerowych | Plik z jego nazwą jako publiczny wpis | `www.linkedin.com`, `api.linkedin.com` |

Własna lista aplikacji komputerowych obejmuje też punkt końcowy tokenów Google do logowania w Drive. Każdy inny host, taki jak wskazany przez Ciebie serwer Mastodon lub Nextcloud, wymaga zgody operatora, jak opisano w części Pliki, które wysyłasz. Hostów wybieranych w chwili użycia, takich jak przechwytywany adres URL lub wskazana zdalna instancja, nie ma na żadnej liście.


**Podpisy SEAL nie wysyłają żadnych żądań.** Verify potrafi sprawdzać podpisy SEAL, schemat, w którym klucz podpisujący może być opublikowany w DNS. Przeglądarki nie mogą wykonywać zapytań DNS, więc wyszukiwanie w sieci musiałoby przejść przez zewnętrzny resolver DNS-over-HTTPS, który widziałby sprawdzaną domenę i Twój adres IP. Lolly kiedyś używało resolvera Cloudflare; już tego nie robi i nic nie zastąpiło Cloudflare. Żadna aplikacja Lolly nie wyszukuje dziś kluczy SEAL: aplikacje komputerowa i mobilna uruchamiają ten sam widok Verify, a polecenie `lolly validate` w wierszu poleceń nie sprawdza SEAL. Plik, którego rekord SEAL niesie klucz w treści, jest sprawdzany offline, a Verify uznaje podpis za wewnętrznie spójny, nie potwierdzając domeny. Plik, którego klucz znajduje się tylko w DNS, pokazuje **SEAL signature did not verify** z powodem "no key resolver and no inline key".

![Ekran Verify: pole upuszczania i nic więcej - plik jest sprawdzany tam, gdzie już jest, bez wysyłania i bez konta](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop)

To i każde inne twierdzenie na tej stronie możesz sprawdzić sam: [Verify It Yourself](/info/verify-yourself.html) podaje polecenia i oczekiwane wyniki.

## Usługi, które prowadzi lolly.tools

Te usługi działają na lolly.tools dla wszystkich. Każda otrzymuje tylko to, co jej wyślesz. [Server Surface](/info/server-surface.html) opisuje te same komponenty tak, jak działają w dowolnym wdrożeniu.

### Linki renderujące

Każdy adres URL `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` naprawdę renderuje obraz, a jego dane wejściowe podróżują w adresie, więc udostępniony link Lolly może pojawić się jako żywy obraz w README, wiki lub panelu. Pobranie takiego linku prosi serwer o wyrenderowanie **publicznych danych narzędzi i katalogu** z danymi wejściowymi zapisanymi w adresie.

- <!--i:usercheck--> **Bez kont, bez plików cookie, bez stanu.** Ta trasa nie wymaga logowania i nic na Twoim urządzeniu nie jest odczytywane. Twoje dokumenty, sesje i wgrane pliki nigdy nie opuszczają przeglądarki i nie mogą pojawić się w tych linkach.
- <!--i:document--> **Sam adres URL jest zapisywany.** Ciąg zapytania adresu jest częścią żądania, więc pojawia się w zwykłych dziennikach dostępu platformy hostingowej jak każda żądana ścieżka. Jeśli dane wejściowe linku zawierają czyjeś imię i nazwisko lub adres e-mail, jak identyfikator z nazwiskiem lub podpis e-mail, **ten tekst trafia do tych dzienników**. Podawaj w linku renderującym tylko to, co umieściłbyś na publicznej stronie.
- <!--i:globe--> **Dane wejściowe i tak są publiczne.** To wszystko, co autor linku wpisał w adres, czytelne dla każdego, do kogo link dotrze. Nie umieszczaj sekretów w udostępnianym linku; Lolly oferuje szyfrowanie linków dla poufnych treści.
- <!--i:eyeoff--> **Buforowane, ograniczone i nieindeksowane.** Odpowiedzi są buforowane i objęte limitem żądań jak każdy publiczny obraz oraz oznaczone `noindex`, aby wyszukiwarki pomijały Twoje renderowania.

Samodzielnie hostowane wdrożenie, które nie chce publicznej trasy renderowania, ustawia `LOLLY_DISABLE_RENDER_GET=1`, a każdy z tych adresów URL zwraca 404.

### Pobieranie obrazów i przekazywanie do Penpot

**Add from URL** w aplikacji internetowej i **Send to Penpot** korzystają z dwóch małych przekazań na lolly.tools, opisanych w części [Każde żądanie sieciowe, jakie może wysłać aplikacja](#every-network-request-the-app-can-make). Pobieranie obrazów niczego nie przechowuje i zapomina adres. Przekazywanie do Penpot przekazuje Twój token i archiwum do Penpot i nie zachowuje żadnego z nich; zapisuje w dzienniku nazwę polecenia i status odpowiedzi Penpot.

### Serwer MCP dla agentów AI

Agent AI może połączyć się z Lolly przez Model Context Protocol, przez punkt końcowy prowadzony przez operatora. lolly.tools prowadzi jeden, a każdy może uruchomić własny, także całkowicie offline.

- <!--i:cpu--> **Pliki wysyłane przez agenta.** Narzędzia przyjmujące plik (`lolly_transform`, `lolly_verify`, `lolly_redact`, `lolly_read`, `lolly_check`, `lolly_package`, `lolly_compose`, `lolly_rebrand` oraz narzędzia obrazu `lolly_look`, `lolly_sample_color` i `lolly_trace_edges`) przetwarzają go w pamięci i zwracają wynik w tym samym wywołaniu. Plik nigdy nie jest zapisywany na dysku i nie jest zachowywany po zakończeniu żądania. `lolly_inspect` także przyjmuje plik, a jego kontrole wideo i przygotowania do druku zapisują tymczasową kopię roboczą, usuwaną po zwróceniu wywołania. Każde inne narzędzie działa na parametrach wywołania: tekście, liczbach, kolorach, adresach URL, identyfikatorach zasobów katalogu lub dokumencie dostarczonym przez wywołującego.
- <!--i:cpu--> **Rebrand podaje, dokąd trafia prezentacja.** Pierwszy etap `lolly_rebrand`, `capabilities`, mówi słowami, dokąd trafią Twoje bajty, zanim cokolwiek wyślesz: na samodzielnie hostowanym serwerze lokalnym prezentacja nigdy nie opuszcza tej maszyny, a na serwerze hostowanym wywołanie `lolly_rebrand` wysyła tam prezentację, do limitów rozmiaru i liczby slajdów podanych na tym etapie.
- <!--i:lock--> **Otwarty punkt końcowy.** Na lolly.tools `lolly.tools/api/mcp` jest otwarty dla każdego bez tokenu. Wywołania są ograniczone na adres i dziennym budżetem. Adres staje się pseudonimowym skrótem w magazynie kontroli nadużyć, jak w punktach końcowych logowania poniżej, a budżet liczy tylko czas CPU i wysłane bajty, bez adresu. Token okaziciela ograniczonego punktu końcowego nigdy nie jest zapisywany w dzienniku ani w adresie URL renderowania.
- <!--i:link--> **Linki do pobrania dużych wyników.** lolly.tools zwraca wyniki w treści odpowiedzi i nigdy nie wydaje tych linków. Operator może je włączyć dla własnej uwierzytelnionej bramy, gdzie wynik jest przechowywany najwyżej pięć minut i może go pobrać tylko własny token okaziciela wywołującego; zobacz [MCP Server](/info/mcp.html#private-download-links-for-large-results). Planowany ograniczony punkt końcowy pod `mcp.lolly.tools` przyjmowałby token okaziciela wydawany przez operatora zaufanym klientom albo OAuth 2.1 z krótkotrwałymi podpisanymi tokenami sprawdzanymi względem wspólnego sekretu; jego aktywacja jest w toku i jest wymieniony w [Hosty dostarczania i podmioty przetwarzające](#delivery-hosts-and-processors).

### Zweryfikowana tożsamość: logowanie, które rozpoczynasz sam

Lolly może zapieczętować **Content Credential** w Twoich eksportach, aby każdy mógł sprawdzić offline, że plik nie zmienił się od opuszczenia Lolly. To jest **domyślnie włączone i w pełni lokalne**: klucz podpisujący powstaje na Twoim urządzeniu, a podpisywanie odbywa się offline. Bez rejestracji ten klucz jest jednorazowy, świeża para kluczy tworzona dla każdego eksportu i odrzucana potem. Po rejestracji klucz jest trwały i generowany jako **niewyodrębnialny**, więc nawet własny kod Lolly nie może go odczytać, a jedynie poprosić o podpis. W obu przypadkach nigdy nie opuszcza Twojego urządzenia.

[Exporting](/info/exporting.html#content-credentials-c2pa) wymienia, co zapisuje poświadczenie: narzędzie, czas, zgrubną powierzchnię eksportu, Twoje imię i nazwisko tylko wtedy, gdy włączyłeś *Use my details*, wymienione dzieła, które eksport umieszcza, oraz każdą piosenkę Rondocode odtwarzaną w eksporcie wideo lub audio (jej nazwę, skrót jej źródła i sposób, w jaki piaskownica Lolly ją wyrenderowała). Panel eksportu wymienia te piosenki przed eksportem.

Poświadczenie i metadane pliku zapisują też [system projektowy i colourway](/info/exporting.html#the-design-system-record), który narysował eksport: identyfikator i nazwę systemu projektowego, jego opublikowaną wersję i colourway. Nazwa systemu projektowego to tekst wpisany przez jego właścicieli i może być nazwą klienta, więc karta **Design system** w panelu eksportu pokazuje dokładne słowa przed eksportem. Odznacz kartę albo podaj `_madewith=0` lub `--no-madewith`, aby je pominąć.

Jedynym *opcjonalnym* krokiem ponad to jest rejestracja zweryfikowanej tożsamości, aby Twoje eksporty mówiły "Verified - signed by \<your email\>" zamiast wskazywać anonimowy klucz. **Jeśli pominiesz rejestrację, usługa certyfikatów nie otrzymuje od Ciebie żadnych danych rejestracyjnych.**

![Karta Verified identity w Settings, szerokość telefonu: wybór czasu życia certyfikatu i krok rejestracji pod nim, nieaktywne, dopóki sam ich nie uruchomisz](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Jeśli się zarejestrujesz, dzieje się dokładnie to:

::: timeline
- <!--i:usercheck--> **Wybierasz metodę logowania**: GitHub, Google, SUSE (id.suse.com) lub link wysłany e-mailem. W przypadku trzech dostawców OIDC przechodzisz na stronę logowania tego dostawcy, pod jego polityką prywatności, nie naszą, a usługa certyfikatów otrzymuje z powrotem tylko zweryfikowany adres e-mail i nazwę dostawcy. W przypadku linku e-mail wpisany adres trafia do **Resend**, transakcyjnej usługi e-mail, wyłącznie w celu dostarczenia tego jednego linku.
- <!--i:lock--> **Krótkotrwały plik cookie chroni przekierowanie.** Usługa certyfikatów ustawia `lolly_ca_state`, `HttpOnly`, ograniczony do `/api/ca` i wygasający w ciągu dziesięciu minut. Niesie losową wartość, a nie identyfikator śledzący, istnieje tylko po to, by uniemożliwić sfałszowanie przekierowania logowania, i jest usuwany zaraz po zakończeniu logowania.
- <!--i:eyeoff--> **Twój adres IP jest krótko używany do zapobiegania nadużyciom** punktów końcowych logowania, aby jeden skrypt nie mógł zalać skrzynki ani wyczerpać limitu e-maili. Lolly zamienia go na skrót SHA-256, zanim trafi do krótkotrwałego magazynu kontroli nadużyć, więc surowy adres tam nie jest wysyłany. Skrót jest pseudonimowy, a nie anonimowy: ktoś, kto ma ten magazyn, mógłby odzyskać adres IPv4, próbując każdego możliwego. Kubełek wygasa po około minucie i nie służy do niczego innego. Zwykłe dzienniki dostępu hostingu są oddzielne i opisane poniżej.
- <!--i:seal--> **Usługa wydaje certyfikat** wiążący Twój zweryfikowany adres e-mail z kluczem publicznym Twojego urządzenia. Klucz prywatny zostaje na urządzeniu: klient wysyła żądanie certyfikatu z powiązanym dowodem posiadania i żaden klucz prywatny urządzenia nie trafia do żadnego z trybów wystawcy.
- <!--i:check--> **Podpisywanie pozostaje lokalne.** Przy starszym wystawcy eksport nie wymaga żądania do usługi certyfikatów. Tożsamość zarządzana potrzebuje też świeżej, podpisanej listy unieważnień od swojego wystawcy; klient może użyć listy z pamięci podręcznej w skonfigurowanym oknie świeżości, a jej odświeżenie może skontaktować się z usługą certyfikatów podczas eksportu. Brakujący, wygasły lub nieprawidłowy status uniemożliwia użycie tożsamości zarządzanej.
:::

::: details Przechowywanie i unieważnianie w każdym trybie wystawcy
**Starsze hostowane wydawanie** oferuje 7, 30, 90 lub 365 dni, ograniczone przez operatora. Nie prowadzi spisu tożsamości ani dziennika wydawania, więc nie może sprawdzić, kto uzyskał certyfikat, ani unieważnić certyfikatów tej osoby; czas życia jest unieważnieniem.

**Zarządzane wydawanie dla organizacji** używa domyślnego czasu życia najwyżej 24 godziny i maksymalnego siedem dni, z własnym korzeniem i polityką zaufania wystawcy, a podpisywanie trafia do wystawcy Vault skonfigurowanego przez operatora. Jego aplikacja rejestracyjna używa wspólnego jednorazowego magazynu dopuszczeń, który przechowuje tylko kluczowany identyfikator uwierzytelnienia i skrót żądania, najwyżej przez dziesięć minut, i nie przechowuje spisu tożsamości ani pamięci podręcznej odpowiedzi certyfikatów. Dostawca PKI, jego urządzenia audytu, bramy i kopie zapasowe mają własne przepływy danych. Nawet gdy zwykłe przechowywanie wydawania jest wyłączone, unieważnianie oparte na certyfikatach może zachować certyfikat, w tym tożsamość e-mail, a numery seryjne unieważnień i identyfikatory audytu mogą pozostać możliwe do powiązania; o tym spisie, o tym, kto ma do niego dostęp, i o czasie przechowywania decyduje polityka Twojego operatora.

Zarządzane urządzenie może poprosić o unieważnienie własnego certyfikatu, z uwierzytelnionym dowodem urządzenia, a żadne API nie prosi o klucz prywatny urządzenia. Operator może wycofać wystawcę przez swoją politykę zaufania. Lolly nie prowadzi mapowania osób na certyfikaty, więc unieważnienie certyfikatów osoby, gdy odchodzi, zależy od zapisów prowadzonych przez operatora, a zapisy PKI, zapisy audytu, odbiorcy i kopie zapasowe podlegają polityce operatora. [Projekt usługi certyfikatów](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md) opisuje przechowywanie kluczy wystawcy, retencję u dostawcy i kwalifikację.
:::

## Usługi organizacji z Lolly Work

**Lolly Work** to opcjonalna usługa organizacyjna projektu Lolly, wdrażana osobno przez każdą organizację, która prowadzi instancję. Połączenie z instancją dodaje dane przechowywane na tym serwerze obok Twojej lokalnej edycji. Jej operator odpowiada za politykę prywatności tego wdrożenia, kontrolę dostępu, odbiorców, retencję i kopie zapasowe.

| Przepływ pracy | Dane obsługiwane przez usługę organizacji |
|---|---|
| Logowanie i provisioning | Oświadczenia dostawcy tożsamości, członkostwo w kontach i grupach, sesje logowania i informacje o urządzeniu. OIDC obsługuje logowanie; administratorzy mogą tworzyć i dezaktywować konta przez SCIM |
| Wspólny katalog i projekty | Wgrane zasoby, metadane i wersje; wspólne projekty i sesje; treści pobrane od skonfigurowanych dostawców bibliotek |
| Collaby robocze | Stan wspólnej sesji, edycje na żywo i obecność uczestników przesyłane przez instancję; zapisany stan jest przechowywany zgodnie z jej polityką magazynu |
| Zarządzane linki udostępniania | Cel linku i ustawienia dostępu, takie jak wygaśnięcie i opcjonalna ochrona hasłem; żądania są rozwiązywane przez instancję i można je unieważnić |
| Przegląd i dostarczanie | Przesłana treść, decyzje o zatwierdzeniu, wybrany cel, przygotowane pliki i potwierdzenia dostarczenia |
| Renderowania i partie na serwerze | Przesłane dane wejściowe narzędzi, żądania renderowania, status i zachowane pliki wynikowe. Te zadania działają na serwerze, a nie na Twoim urządzeniu |
| Raportowanie użycia | Etykiety zdarzeń z listy dozwolonych, takie jak identyfikator narzędzia, format i identyfikator zasobu, zgodnie z polityką telemetrii poniżej |
| Audyt | Zapisy o wykonawcy i działaniu dla operacji objętych nadzorem, przechowywane oddzielnie od telemetrii użycia |

Usługa używa plików cookie uwierzytelniania, w tym `lw_session` dla zalogowanych członków i `lw_guest` dla dostępu gościa, tam gdzie jest włączony, oddzielnych od pliku cookie usługi certyfikatów. Odświeżanie polityk i włączone raportowanie użycia mogą wysyłać żądania podczas korzystania z aplikacji, bez osobnego kliknięcia dla każdego. To ruch do skonfigurowanej instancji, a nie raport dla projektu Lolly o wdrożeniach, których nie prowadzi.

**Telemetria użycia ma trzy poziomy.** `off` nie przechowuje żadnych zdarzeń użycia, `aggregate` usuwa identyfikatory użytkowników, a `standard` może przypisywać zdarzenia. Domyślny poziom to `standard`, więc instancja przechowuje otrzymywane zdarzenia użycia, chyba że jej operator wybierze `off`. Domyślna polityka przypisywania to `opt-in`, która wymaga Twojej zgody, zanim identyfikator użytkownika zostanie zapisany; operator może zamiast tego skonfigurować raportowanie z przypisaniem przez `telemetryAttribution: default`. Dozwolone atrybuty to etykiety, nigdy wartości danych wejściowych narzędzi. Zobacz [Work telemetry](/info/work-telemetry.html).

**Audyt jest oddzielny.** Działania objęte nadzorem mogą zachowywać zapis audytu ze wskazaniem osoby niezależnie od Twojej zgody na telemetrię. Wyłączenie telemetrii nie wyłącza przechowywania wspólnych sesji, zapisów zatwierdzeń, przechowywania zadań renderowania ani audytu. Operator kontroluje retencję i usuwanie, w tym ewentualną pseudonimizację dziennika audytu; zobacz [Work storage and data lifecycle](/info/work-data-lifecycle.html).

| | Twoje urządzenie | Instancja Twojej organizacji |
|---|---|---|
| Co przechowuje | Twoją osobistą pracę, preferencje i pamięci podręczne | Wspólną pracę, konta, wgrane pliki, zatwierdzenia, renderowania, audyt i skonfigurowaną telemetrię |
| Kto to usuwa | Ty, przez **Clear all my data** lub dane witryny w przeglądarce | Operator, przez własne mechanizmy instancji |
| Kogo zapytać | Nikogo: zapisy są na Twoim urządzeniu | Operatora instancji, w sprawie dostępu, eksportu lub usunięcia |

**Usunięcie lokalne to nie usunięcie na serwerze.** Opuszczenie instancji lub wyczyszczenie przeglądarki usuwa stan lokalny, a nie zapisy i kopie zapasowe organizacji. Osobisty [Sync](/info/sync.html) i **Export my data** tworzą kopię zapasową Twojego urządzenia, a nie usługi organizacji. Publiczne demo [lolly.work](https://lolly.work) trzyma stan wyłącznie w pamięci i nie jest trwałym magazynem Twojej pracy.

## Rozszerzenie przeglądarki

Rozszerzenie przeglądarki **Lolly URL Screenshot** nie zbiera dla nas żadnych danych osobowych. Nie ma analityki, śledzenia ani własnego serwera. Strona [Browser extension](/info/extension.html) opisuje, jak działa.

**Co robi.** Aplikacja internetowa Lolly może poprosić je o zrzut ekranu strony albo o zawartość strony, aby zacząć system projektowy od witryny. Każde żądanie otwiera w rozszerzeniu okno zatwierdzenia, które pokazuje witrynę wysyłającą żądanie, czy chce zrzutu ekranu, czy zawartości strony, oraz adres strony. Dopiero po naciśnięciu **Approve once** rozszerzenie otwiera tę stronę w tymczasowej karcie w tle, robi zrzut lub odczytuje stronę, przekazuje wynik karcie Lolly, która o to poprosiła, i zamyka kartę. Każde żądanie wymaga osobnego zatwierdzenia.

**Dane.**

- <!--i:shieldcheck--> **Niczego nie zbieramy.** Wynik trafia tylko na stronę Lolly, która o niego poprosiła, w tej samej przeglądarce. Rozszerzenie nie przechowuje zawartości stron i nie dodaje żadnego innego odbiorcy.
- <!--i:globe--> **Żądania sieciowe.** Zatwierdzona strona ładuje się tak jak w każdej karcie, razem ze wszystkim, czego sama zażąda. Odczyt zawartości strony pobiera też jej arkusze stylów i kilka obrazów ikon i logo, z wnętrza strony, a te pobrania nie wysyłają plików cookie do innych witryn. Rozszerzenie nie wykonuje innych żądań i żadne nie trafia na serwer Lolly.
- <!--i:lock--> **Sesja Twojej przeglądarki.** Strona ładuje się z sesją Twojej przeglądarki, tak jak gdybyś otworzył ją sam, więc strona, na którą jesteś zalogowany, może umieścić w wyniku prywatne informacje.
- <!--i:link--> **Zatwierdzone przez Ciebie adresy** służą tylko do załadowania tej jednej strony dla tego jednego żądania. Nie są zapisywane w dziennikach ani udostępniane.

**Uprawnienia.**

- <!--i:wrench--> **`debugger`**: do wykonania zrzutu ekranu przez DevTools Protocol, ten sam mechanizm, którego używa aplikacja komputerowa Lolly.
- <!--i:monitor--> **`tabs`**: do otwarcia i zamknięcia tymczasowej karty oraz do sprawdzenia, że ani strona Lolly, ani strona docelowa nie zmieniły adresu od zatwierdzenia.
- <!--i:code--> **`scripting`**: do odczytania zawartości strony w tymczasowej karcie, po zatwierdzeniu tego żądania.
- <!--i:database--> **`storage`**: do zapisania identyfikatorów tymczasowych kart w pamięci sesji, aby nadal się zamykały, jeśli przeglądarka zatrzyma rozszerzenie w trakcie żądania. Zawartość stron nie jest przechowywana.
- <!--i:check--> **Opcjonalny dostęp do witryn (`http://*/*`, `https://*/*`)**: nie jest przyznawany przy instalacji. Po naciśnięciu **Approve once** rozszerzenie prosi Chrome o dostęp do jednej witryny z tego żądania, a Chrome pyta Cię przy pierwszym razie dla każdej witryny. Witryna, na którą zezwoliłeś wcześniej, nadal wymaga świeżego zatwierdzenia przy każdym żądaniu.

Żadne z tych uprawnień nie służy do czytania, monitorowania ani przesyłania Twojego przeglądania poza jednym zatwierdzonym przez Ciebie żądaniem.

## Hosty dostarczania i podmioty przetwarzające

Publiczne pliki katalogu, narzędzia i wersje wyświetlania pochodzą domyślnie z własnego adresu aplikacji. Nazwy adresowane treścią zmieniają to, skąd plik jest pobierany, a nie to, kto otrzymuje żądanie. Ta funkcja dostarczania nie aktywuje żadnego zewnętrznego CDN. CDN kończący TLS otrzymywałby szczegóły żądań, w tym adresy IP i wszelkie pliki cookie lub poświadczenia okaziciela przekazane do niego, nawet pod tą samą nazwą hosta przeglądarki, więc operator, który go dodaje, przyjmuje nowy podmiot przetwarzający.

**Przed dodaniem jakiegokolwiek CDN lub zewnętrznego hosta modeli** administrator musi opublikować nazwę podmiotu przetwarzającego, nazwę hosta, jurysdykcje, otrzymywane metadane, retencję i ustalenia dotyczące transferu. [Delivery deployment](/info/deploy-delivery.html) wymienia, co ujawnić. Prywatne odpowiedzi przestrzeni roboczej omijają współdzielone pamięci podręczne: wyniki osobiste, odmowy dostępu i błędy używają `private, no-store`, a dozwolona odpowiedź prywatna może być rewalidowana w Twojej przeglądarce bez stawania się publiczną.

Usługi referencyjne korzystają z poniższego hostingu. To lista nazw hostów, a nie twierdzenie, że instancja innej organizacji używa tego samego regionu.

| Nazwa hosta lub usługa | Funkcja i odbiorca | Region i obsługa danych |
|---|---|---|
| lolly.tools | Publiczna aplikacja, katalog, renderowanie i usługi certyfikatów; hosting UpCloud | Frankfurt, Niemcy. Szczegóły żądań mogą pojawiać się w dziennikach infrastruktury; zwykła edycja lokalna zostaje na urządzeniu |
| lolly.ing | Zarządzana przestrzeń robocza i usługi agenta dokumentów; hosting UpCloud | Frankfurt, Niemcy. Prywatna baza danych i magazyn plików są na tym samym hoście. Konta, wspólne treści i zapisy usługi podlegają polityce administratora instancji |
| mcp.lolly.tools | Planowana opcjonalna uwierzytelniana brama MCP i prywatne pobieranie wyników; hosting UpCloud | Frankfurt, Niemcy, u tego samego podmiotu przetwarzającego hosting. Aktywacja w toku. Brama otrzymywałaby szczegóły żądań oraz parametry lub pliki, które wysyła jej wywołujący |
| lolli.li | Publiczne pliki wydań i modeli; UpCloud Managed Object Storage, oddzielny od klastra aplikacji | Frankfurt, Niemcy, w regionie magazynu obiektów europe-2 UpCloud. Pobranie wysyła szczegóły żądania, a nie dane wejściowe, które model przetworzy później |
| Skonfigurowany dostawca tożsamości | Google, GitHub lub dostawca OIDC operatora | Logowanie podlega polityce tego dostawcy. Zapytaj operatora instancji o nazwę hosta, region i ustalenia dotyczące transferu |
| Skonfigurowany dostawca zasobów | Brandfolder lub inna biblioteka wybrana przez operatora | Dostawca otrzymuje dozwolone żądania biblioteki. Dostępem rządzą uprawnienia jej źródła i polityka instancji; zapytaj operatora o jej nazwy hostów i regiony |
| Rejestracja e-mail, gdy skonfigurowana | Resend dostarcza żądany link logowania | Otrzymuje docelowy adres e-mail tej wiadomości; obowiązują jego własne warunki przetwarzania |

Aplikacja referencyjna nie korzysta z żadnego innego hostingu, bazy danych ani dostawcy kontroli nadużyć. Operator może wybrać innych dostawców dla innej instancji, a hosting, tożsamość, zasoby i dostawcy e-mail wymagają każdy własnego ujawnienia. [Region magazynu obiektów](https://upcloud.com/docs/products/managed-object-storage/availability/) hosta modeli jest weryfikowany oddzielnie od regionu aplikacji.

**Opcjonalne linki pobierania MCP powiązane z podmiotem.** Operator może włączyć linki pobierania dużych wyników na uwierzytelnianej bramie z jedną repliką. Domyślnie są wyłączone. Anonimowa brama pod `lolly.tools/api/mcp` zwraca wyniki w treści odpowiedzi i nigdy nie wydaje tych linków. Planowana ograniczona nazwa hosta to `mcp.lolly.tools`, u tego samego podmiotu UpCloud we Frankfurcie; aktywacja jest w toku, a ta strona nie twierdzi, że działa usługa linków pobierania. Linki nie dodają żadnego zewnętrznego CDN.

Link może otrzymać tylko uwierzytelniony wywołujący z zakresem plików, a do jego pobrania wymagany jest token okaziciela tego samego wywołującego: użyj zweryfikowanego tokenu z wywołania renderowania, a nie innego tokenu tego samego konta. Przyznanie wygasa w ciągu 300 sekund. Własność i wyszukiwanie wyniku pozostają w pamięci bramy, a bajty wyniku trafiają do prywatnych plików tymczasowych, usuwanych po wygaśnięciu lub przy czystym zamknięciu. Restart bramy unieważnia istniejące linki. Przechowywane wyniki są ograniczone do 64 MiB na token okaziciela, 256 MiB na całą bramę i 200 oczekujących lub przechowywanych plików. Dzienne budżety CPU i zdekodowanych bajtów liczą wyniki, gdy są przechowywane i gdy są pobierane. Odpowiedzi używają `private, no-store` i `Referrer-Policy: no-referrer`. Sam token linku nie pozwala innej osobie ani agentowi odczytać wyniku.

## Logi infrastruktury

Ta sekcja opisuje publiczne wdrożenie lolly.tools. Jego platforma hostingowa zapisuje zwykłe szczegóły żądań: adres IP, żądaną ścieżkę, znacznik czasu i user agent. Lokalne edycje nie docierają do tego hosta. Ciąg zapytania linku renderującego może zawierać tekst dostarczony przez wywołującego, jak wyjaśniono wyżej. Narzędzia plików MCP przetwarzają otrzymane bajty w pamięci. Instancja Lolly Work przechowuje też opisane wyżej zapisy, zgodnie z polityką logowania jej operatora.

**Usługi publiczne ograniczają logowanie aplikacji do minimum.** Serwer MCP zapisuje start, konfigurację i ostrzeżenia renderowania; nie prowadzi własnego dziennika żądań i nie zapisuje tokenów ani adresów wywołujących. Przekazywanie do Penpot zapisuje nazwę każdego polecenia i status odpowiedzi Penpot, nigdy nagłówków, tokenów ani pliku. Usługa certyfikatów zapisuje swoje ustawienia startowe i ostrzeżenia konfiguracji oraz dwie okrojone linie przy błędzie: kod statusu niepowodzenia wysyłki bez adresu odbiorcy i stałą linię niepowodzenia bez tekstu błędu, śladu stosu ani adresu URL, ponieważ błąd dostawcy może zawierać wartości tożsamości lub poświadczenia. Wszystko inne w dzienniku pochodzi z platformy hostingowej.

W przypadku lolly.tools administrator instancji kontroluje logowanie żądań, rotację i retencję w UpCloud. Ta strona nie podaje maksymalnego okresu przechowywania dzienników, który nie został zweryfikowany. Skontaktuj się z administratorem danych poniżej w sprawie aktualnego harmonogramu i każdej prośby dotyczącej dzienników przechowywanych na serwerze. W przypadku innej instancji obowiązują ustawienia jej operatora, w tym ewentualne eksporty dzienników lub inne podmioty przetwarzające.

## Podstawy prawne, okres przechowywania i odbiorcy

Ta tabela dotyczy referencyjnego wdrożenia **lolly.tools**. Nie podaje podstaw prawnych ani okresów przechowywania instancji Lolly Work Twojej organizacji; jej operator podaje je we własnej polityce.

| Przetwarzanie | Podstawa prawna (RODO art. 6) | Okres przechowywania |
|---|---|---|
| Wszystko na Twoim urządzeniu (dokumenty, preferencje, pamięć podręczna, liczniki) | **W ogóle nie jest to nasze przetwarzanie**: nigdy do nas nie trafia. Przechowywanie na Twoim urządzeniu jest ściśle niezbędne do usługi, o którą prosisz (ePrivacy art. 5 ust. 3), więc nie wymaga zgody | Do czasu, aż to usuniesz |
| Twój adres e-mail podczas rejestracji w starszych hostowanych Content Credentials | **Art. 6 ust. 1 lit. b**, wykonanie usługi, o którą wyraźnie prosisz | Brak spisu tożsamości ani dziennika wydawania w starszej usłudze; e-mail jest używany podczas żądania i zawarty w Twoim certyfikacie. Retencja zarządzanego PKI organizacji, audytu i unieważnień podlega polityce jej operatora |
| Pseudonimowy skrót SHA-256 z Twojego adresu IP, do ograniczania liczby żądań do punktów końcowych logowania oraz publicznych punktów renderowania, obrazów i MCP | **Art. 6 ust. 1 lit. f**, nasz prawnie uzasadniony interes w zapobieganiu nadużyciom bezpłatnej usługi i limitu e-mail osoby trzeciej. Uważamy, że przechodzi to test równowagi, ponieważ surowy adres nie jest wysyłany do limitera, skrót służy tylko do kontroli nadużyć i wygasa sam | Około jednej minuty w magazynie kontroli nadużyć; potem nie jest przechowywany |
| Dzienniki dostępu hostingu (IP, ścieżka, znacznik czasu, user agent) | **Art. 6 ust. 1 lit. f**, nasz prawnie uzasadniony interes w bezpieczeństwie usługi, zapobieganiu nadużyciom i diagnozowaniu usterek | Rotacja i retencja skonfigurowane przez administratora; skontaktuj się z administratorem danych w sprawie aktualnego harmonogramu |

**Odbiorcy.** Kategorie odbiorców to nasz dostawca hostingu (UpCloud), który hostuje bazę danych aplikacji i magazyn kontroli nadużyć, oraz, tylko jeśli używasz logowania e-mailem, transakcyjny dostawca e-mail (Resend). Magazyn kontroli nadużyć otrzymuje wyłącznie krótkotrwałe skróty, nigdy surowy adres IP. Jeśli logujesz się przez GitHub, Google lub SUSE (id.suse.com), masz do czynienia bezpośrednio z tym dostawcą, na podstawie jego własnej polityki prywatności, a on przekazuje nam zweryfikowany adres e-mail i nic więcej. Nie udostępniamy danych osobowych nikomu innemu, nie sprzedajemy danych, nie prowadzimy reklam ani nie profilujemy użytkowników.

**Transfery poza EOG.** Hosting, baza danych i magazyn plików aplikacji referencyjnej znajdują się we Frankfurcie. Opcjonalni dostawcy tożsamości, e-mail i zasobów mają własne lokalizacje przetwarzania i warunki, które mogą obejmować dostęp spoza EOG, a sam region serwera nie ustala jurysdykcji każdego odbiorcy. Skontaktuj się z administratorem danych w sprawie umów z dostawcami i ustaleń dotyczących transferu, które mają zastosowanie; w przypadku innej instancji zapytaj jej operatora. [Standardowe klauzule umowne](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en) Komisji Europejskiej są jednym z zabezpieczeń dostępnych dla takich transferów; ta strona nie twierdzi, że niezweryfikowana umowa z dostawcą z nich korzysta.

**Zautomatyzowane podejmowanie decyzji.** Brak. Nie ma profilowania ani zautomatyzowanej decyzji wywołującej skutki prawne lub podobnie istotne (art. 22).

## Prywatność dzieci

Zwykłe lokalne korzystanie z aplikacji nie wysyła do lolly.tools żadnych treści osobistych. Jego opcjonalna rejestracja Content Credentials otrzymuje adres e-mail i nie jest skierowana do dzieci ani przeznaczona dla nich. Usługi organizacji mają własne konta i obsługę danych, zgodnie z polityką ich operatora.

## Twoje prawa

W przypadku zapisów przechowywanych tylko na Twoim urządzeniu możesz sam uzyskać dostęp do danych, poprawiać je, usuwać i przenosić. Znajdują się w pamięci przeglądarki lub aplikacji, w formie, którą możesz sprawdzić, wyeksportować (**Export my data**, wyżej) lub usunąć (**Clear all my data** albo dane witryny w przeglądarce).

Formalnie, na podstawie art. 15-22 RODO masz prawo do **dostępu** do swoich danych osobowych, ich **sprostowania**, **usunięcia**, **ograniczenia** lub **sprzeciwu wobec** ich przetwarzania (w tym wszystkiego, co opieramy na prawnie uzasadnionych interesach), do **przenoszenia danych** oraz, gdy przetwarzanie opiera się na zgodzie, do **wycofania tej zgody w dowolnym momencie**, bez wpływu na zgodność z prawem tego, co nastąpiło przed jej wycofaniem.

Publiczna usługa certyfikatów nie prowadzi dziennika wydawania. Dzienniki infrastruktury mogą zawierać szczegóły żądań, więc ta polityka nie obiecuje, że środowisko hostingowe nie przechowuje żadnych danych osobowych. Skontaktuj się z administratorem danych w sprawie dostępu, usunięcia lub innej prośby dotyczącej tych zapisów; wyjaśnimy, jakie zapisy istnieją i co można zrobić. W sprawie pracy, tożsamości, telemetrii i zapisów audytu przechowywanych przez organizację skontaktuj się z operatorem Lolly Work, ponieważ lokalne mechanizmy eksportu i usuwania nie sięgają tych kopii.

**Masz prawo do wniesienia skargi.** Jeśli uważasz, że przetwarzaliśmy Twoje dane niewłaściwie, możesz złożyć skargę do organu nadzorczego ds. ochrony danych: w UE jest to organ w kraju Twojego miejsca zamieszkania, pracy lub domniemanego naruszenia (art. 77). Naszym wiodącym organem nadzorczym jest *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) w Ansbach w Niemczech. Nie musisz najpierw kontaktować się z nami, choć chcielibyśmy mieć szansę naprawienia problemu.

## Zmiany w niniejszej polityce

Data na górze zmienia się za każdym razem, gdy zmienia się ten dokument. Zmiana, która wpływa na to, co opuszcza Twoje urządzenie lub co jest przechowywane, dostaje tutaj osobną linię zamiast cichej edycji. Aby zobaczyć, co się zmieniło, zapytaj (poniżej) lub porównaj z [publicznym źródłem](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

**29 września 2026:** wyjaśniono opcjonalną usługę lolly.work, treści przechowywane przez organizację, pliki cookie uwierzytelniania, telemetrię użycia i zapisy audytu oraz rozdzielenie usunięcia lokalnego od retencji na serwerze. Są to istniejące opcjonalne przepływy pracy, a nie nowy wymóg wysyłania przy lokalnej edycji.

**11 października 2026:** zastąpiono opis wycofanego hostingu Vercel spisem nazw hostów aplikacji w UpCloud, rozróżniono opcjonalnych dostawców tożsamości i zasobów oraz opisano dostarczanie adresowane treścią i tryb przechowywanych pobrań MCP. Ta zmiana nie włącza żadnego zewnętrznego CDN. Retencją dzienników steruje administrator, a nie podany domyślny plan Vercel.

**22 października 2026:** poprawiono opis istniejącego zachowania. Sekcja rozszerzenia przeglądarki obejmuje teraz okno zatwierdzenia dla każdego żądania, dostęp do witryny proszony po jednej witrynie naraz oraz pobieranie arkuszy stylów i ikon przy odczycie witryny. Poprawiono też: wiersze Send to Google Drive i Meeting Planner, notę o SEAL (żadna aplikacja Lolly nie wyszukuje kluczy SEAL w DNS), domyślny poziom telemetrii użycia usługi organizacji, narzędzia obrazu MCP i logowanie aplikacji w usługach publicznych. Samo oprogramowanie się nie zmieniło.

**23 października 2026:** uporządkowano politykę według tego, co uruchamia każde żądanie, i opisano istniejące zachowanie, którego wcześniej nie obejmowała: prywatne zaproszenia do collabów niosące adresy sieci lokalnej, Nearby w aplikacji komputerowej, Allow AI control, odczyt systemu projektowego ze strony internetowej, zestawy emoji, pamięć podręczną wyszukiwań miast w Meeting Planner na urządzeniu, Kosz i inne zapisy wymienione w Settings → Storage. Poprawiono dwa stwierdzenia: Bluesky i Discord nie są tylko na komputer, a każdy host wybrany przez osobę do wysyłania wymaga zgody operatora zarówno w aplikacji internetowej, jak i komputerowej; skrót adresu IP do ograniczania żądań jest pseudonimowy, a nie anonimowy. Samo oprogramowanie się nie zmieniło.

## Kto ponosi odpowiedzialność i jak się z nami skontaktować

**Administratorem danych** dla lolly.tools jest:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Niemcy

SUSE wyznaczyło **Inspektora Ochrony Danych**, dostępnego pod adresem [privacy@suse.com](mailto:privacy@suse.com). Użyj tego adresu w każdej formalnej sprawie w ramach "Twoich praw" powyżej.

W sprawach dotyczących samego Lolly, takich jak sposób działania, powód, dla którego coś jest tak, jak jest, lub poprawka do tego dokumentu, skontaktuj się z **Andym Fitzsimonem**, [fitzy@suse.com](mailto:fitzy@suse.com).

W przypadku samodzielnie hostowanej lub firmowej instancji Lolly skontaktuj się zamiast tego z jej operatorem: operator jest administratorem danych dla własnego wdrożenia. SUSE i projekt open source Lolly nie przechowują żadnych danych dla wdrożeń, których nie prowadzą.
