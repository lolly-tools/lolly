# Korzystaj z Lolly w swojej organizacji

Twoja organizacja może prowadzić własne Lolly: tę samą aplikację z wybranymi przez siebie narzędziami i systemami projektowymi. Dowiedz się, jak do niej dotrzeć, zalogować się i co się zmienia.

Jeśli planujesz konfigurację dla organizacji, [Korzystanie z Lolly z istniejącym systemem DAM](/info/use-with-dam.html) wyjaśnia, jak zachować zatwierdzoną bibliotekę, gdy użytkownicy tworzą treści w Lolly. [Suwerenność treści](/info/content-sovereignty.html) opisuje szerszą kontrolę nad tworzeniem, nadzorem, przechowywaniem i przenoszeniem treści.

::: note Czego potrzebujesz od organizacji
Adresu internetowego jej Lolly lub utworzonego przez nią pliku konfiguracyjnego `.lolly`. Samo lolly.tools nie łączy się z organizacją.
:::

<!--i:eti-globe-->
## W przeglądarce

Otwórz adres podany przez organizację. Jeśli strona prosi o zalogowanie, naciśnij **Sign in** i postępuj zgodnie z instrukcjami na otwartej stronie logowania. Potem Lolly działa jak zwykle, z narzędziami i systemami projektowymi Twojej organizacji.

Możesz też zacząć od lolly.tools: otwórz widok **Settings**, na karcie **Lolly instance** naciśnij **Open a workspace**, wpisz adres i naciśnij **Open this instance**. Przeglądarka przejdzie pod własny adres Twojej organizacji, ponieważ nie może wczytać narzędzi innego Lolly z lolly.tools.

![Karta Lolly instance w Settings, gdzie otwierasz obszar roboczy organizacji lub zmieniasz źródło narzędzi aplikacji](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

<!--i:eti-monitor-->
## W aplikacji komputerowej lub mobilnej

Aplikacja uruchamia się z dołączonymi narzędziami. Aby się połączyć, otwórz widok **Settings** i naciśnij **Change** na karcie **Lolly instance**. Panel pyta **Where should Lolly get its tools?**

1. Wybierz **Connect to a Lolly instance**.
2. Wpisz adres internetowy organizacji i naciśnij **Check & connect**.
3. Naciśnij **Use this instance**. Następny ekran, **Import your data (optional)**, przenosi zapisaną pracę z kopii zapasowej Lolly. Naciśnij **Skip**, jeśli jej nie masz.
4. Zaloguj się, jeśli aplikacja o to poprosi.

Narzędzia z połączonej instancji działają z takim samym poziomem zaufania jak własne narzędzia aplikacji, więc łącz się tylko z instancją, której ufasz. Organizacja może zamiast tego wysłać plik konfiguracyjny `.lolly`, który połączy aplikację za Ciebie.

Aby później zmienić instancję, ponownie użyj **Change** lub **Leave** na tej samej karcie.

### Logowanie kodem

W aplikacjach komputerowej i mobilnej ekran logowania oferuje też krótki kod, jeśli Lolly Twojej organizacji obsługuje logowanie kodem. Naciśnij **Open sign-in in browser**, zaloguj się i zatwierdź tam kod. Możesz też otworzyć wyświetlany adres na telefonie lub komputerze, na którym jesteś już zalogowany, i wpisać kod. Kod jest ważny około dziesięciu minut.

<!--i:eti-sliders-->
## Co się tam zmienia

- **Niektóre kontrolki są ustawione za Ciebie.** Kontrolka zarządzana przez organizację pokazuje **Managed by** i nazwę organizacji lub **Managed by your organisation**. Zablokowanej kontrolki nie można zmienić, a menu może oferować tylko część opcji. Niektóre kontrolki są ukryte. Konsola organizacji zapisuje, która reguła zablokowała kontrolkę i dlaczego. Zapytaj osobę prowadzącą Lolly w Twojej organizacji.
- **Niektóre systemy projektowe są zablokowane.** System projektowy dostarczony przez organizację ma ikonę kłódki i pozostaje tylko do odczytu. Aby wypróbować zmiany, utwórz edytowalną kopię w **Settings → Preferences → Design systems**.
- **Lista zawiera tylko jej narzędzia.** Narzędzie, którego organizacja nie oferuje, nie jest wyświetlane.
- **Wspólne projekty.** Jeśli organizacja udostępnia Ci projekty, w **Projects** pojawia się kafelek **Team projects**. Te sesje są przechowywane na serwerze organizacji. Otwórz sesję, aby nad nią pracować, lub rozpocznij [współpracę służbową](/info/collaborate.html#collabs-through-lolly-work-optional) przez **Share**, gdy ta opcja jest dostępna.
- **Niektóre eksporty mogą wymagać zatwierdzenia.** Gdy organizacja wymaga zatwierdzenia, **Request approval** zastępuje **Download**, a narzędzie może oferować mniej formatów.
- **Ekran główny może otwierać się na szablonach.** Jeśli organizacja publikuje dla Ciebie szablony, tak jak może to robić dla firmy partnerskiej, ekran główny pokazuje je zamiast powitania przy pierwszej wizycie. Każdy szablon to jedna karta z **Your copy** do kontynuowania pracy i **New version**, gdy szablon się zmieni. Zobacz [Szablony dla partnerów](/info/work-partner-templates.html).

### Co zostaje gdzie

::: cols
## Na tym urządzeniu

- Twoje zapisane prace, chyba że włączysz [Sync](/info/sync.html)
- Systemy projektowe utworzone samodzielnie
- Wszystko, co tworzysz i pobierasz

## Na serwerze Twojej organizacji

- Twoja tożsamość używana do logowania i informacje o urządzeniu
- Projekty zespołowe, wspólne sesje i zmiany na żywo we współpracy służbowej
- Zasoby przesyłane do wspólnej biblioteki
- Prośby o zatwierdzenie i zatwierdzone dostarczenia
- Rejestr Twoich logowań i działań w tym środowisku
:::

Po połączeniu z obszarem roboczym informacja o prywatności na pierwszym ekranie aplikacji mówi to samo. Własne aplikacje Lolly nie wysyłają do obszaru roboczego zdarzeń dotyczących użycia. [Prywatność](/info/privacy.html#organisation-services-with-lolly-work) wylicza, co serwer przechowuje i kto kontroluje te dane.

<!--i:eti-building-->
## Co dodaje Lolly Work

Na serwerze Twojej organizacji działa **Lolly Work**, oprogramowanie dla organizacji należące do tego samego projektu open source. Gdy korzystasz z aplikacji samodzielnie, nie potrzebuje ona konta służbowego ani Lolly Work.

::: details Co może dodać Lolly Work
Twoja organizacja hostuje [Lolly Work](https://github.com/lolly-tools/lolly-work) obok Lolly i wybiera funkcje do włączenia:

- **Logowanie i dostęp.** Jednokrotne logowanie organizacji, uprawnienia oparte na grupach i zarządzane pola profilu. Administratorzy mogą zakładać i dezaktywować konta przez SCIM.
- **Wspólna praca.** Projekty zespołowe, wspólne sesje i [współpraca służbowa](/info/collaborate.html#collabs-through-lolly-work-optional) z edycją na żywo przez serwer organizacji.
- **Wspólna biblioteka zasobów.** Przesłane zasoby, kolekcje i połączone biblioteki, z regułami dostępu, wersjami i weryfikacją.
- **Weryfikacja i dostarczanie.** Etapy zatwierdzania, zarządzane linki z datą wygaśnięcia lub możliwością unieważnienia oraz dostarczanie do miejsc dozwolonych przez organizację.
- **Administracja.** Zapis audytu działań objętych nadzorem oraz raporty użycia zgodne z polityką telemetrii instancji dla klientów wysyłających zdarzenia dotyczące użycia. Własne aplikacje Lolly obecnie ich nie wysyłają.
:::

Aby skonfigurować usługę, zacznij od [Wdrożenia](/info/deployment.html#organisation-services-with-lolly-work). Publiczne demo pod adresem [lolly.work](https://lolly.work) to środowisko testowe. Do pracy, którą chcesz zachować, używaj własnego adresu organizacji.

<!--i:eti-palette-->
## Marka innej organizacji

Partner, klient lub sponsor może zamiast adresu wysłać Ci swoją markę jako plik systemu projektowego (`.lolly`). Otwarcie tego pliku z niczym nie łączy aplikacji. Plik dodaje system projektowy tej organizacji obok Twojego na tym urządzeniu. Plik konfiguracyjny od Twojej organizacji łączy aplikację z jej Lolly. Zanim cokolwiek się zmieni, podgląd pokazuje skutki otwarcia pliku. [Współpraca z partnerami](/info/partners.html) opisuje obie strony pracy z marką innej organizacji.

<!--i:eti-unlink-->
## Odłączanie

**Leave** na karcie **Lolly instance** w **Settings** usuwa system projektowy, narzędzia i katalog organizacji. Twoja praca zostaje. Niczego utworzonego jej narzędziami nie otworzysz ponownie do czasu ponownego połączenia. Jeśli Lolly Twojej organizacji udostępnia tę opcję, **Sign out everywhere** na tej samej karcie kończy Twoje sesje na wszystkich urządzeniach, także na tym.

Wszystko zapisane w organizacji pozostaje w niej, zgodnie z jej zasadami dostępu i przechowywania. Odłączenie lub wyczyszczenie tego urządzenia nie usuwa kopii na serwerze. W przeglądarce pod własnym adresem organizacji nie ma czego odłączać: po prostu otwórz inny adres.

<!--i:eti-help-->
## Kogo zapytać

O tym, co trafia na serwer organizacji, kto widzi jej wspólne projekty i które ustawienia są zablokowane, decyduje organizacja. Zapytaj osobę prowadzącą w niej Lolly. [Prywatność](/info/privacy.html) opisuje, co samo Lolly robi z Twoimi danymi.
