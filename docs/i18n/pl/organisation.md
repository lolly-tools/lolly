# Używaj Lolly w swojej organizacji

Twoja organizacja może prowadzić własne Lolly: tę samą aplikację z narzędziami i systemami projektowymi, które wybrała. Ta strona pokazuje, jak do niej dotrzeć, jak się zalogować i co się zmienia po zalogowaniu.

::: note Czego potrzebujesz od swojej organizacji
Adresu internetowego jej Lolly albo pliku instalacyjnego `.lolly`, który przygotowała twoja organizacja. Samo lolly.tools nie łączy się z żadną organizacją.
:::

## W przeglądarce

Otwórz adres podany przez organizację. Jeśli strona prosi o zalogowanie, naciśnij **Sign in** i postępuj według otwartej strony logowania. Potem działa jak każde Lolly, z narzędziami i systemami projektowymi Twojej organizacji.

Możesz też zacząć od lolly.tools: otwórz **Settings**, na karcie **Lolly instance** naciśnij **Open a workspace**, wpisz adres i naciśnij **Open this instance**. Przeglądarka przechodzi na własny adres Twojej organizacji, ponieważ przeglądarka nie może załadować narzędzi innego Lolly z lolly.tools.

![Karta Lolly instance w Settings, na której otwierasz przestrzeń roboczą organizacji lub zmieniasz źródło narzędzi aplikacji](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

## W aplikacji desktopowej lub mobilnej

Aplikacja startuje z wbudowanymi narzędziami. Aby się połączyć, otwórz **Settings** i naciśnij **Change** na karcie **Lolly instance**. Arkusz pyta **Where should Lolly get its tools?**

1. Wybierz **Połącz się z instancją Lolly**.
2. Wpisz adres internetowy swojej organizacji i naciśnij **Sprawdź i połącz**.
3. Naciśnij **Użyj tej instancji**. Następny ekran, **Zaimportuj swoje dane (opcjonalnie)**, przenosi zapisaną pracę z kopii zapasowej Lolly; naciśnij **Pomiń**, jeśli jej nie masz.
4. Zaloguj się, jeśli aplikacja o to poprosi.

Narzędzia z połączonej instancji działają z takim samym zaufaniem jak własne narzędzia aplikacji, więc łącz się tylko z instancją, której ufasz. Twoja organizacja może zamiast tego wysłać ci plik instalacyjny `.lolly`, który połączy aplikację za ciebie.

Aby przełączyć później, użyj ponownie **Change** lub **Leave** na tej samej karcie.

### Logowanie kodem

W aplikacjach komputerowych i mobilnych ekran logowania oferuje też krótki kod, gdy Lolly Twojej organizacji obsługuje logowanie kodem. Naciśnij **Open sign-in in browser**, zaloguj się i zatwierdź tam kod. Albo otwórz pokazany adres na telefonie lub komputerze, na którym już jesteś zalogowany, i wpisz kod. Kod ważny jest około dziesięciu minut.

## Co jest tam inaczej

- **Niektóre kontrolki są ustawione za Ciebie.** Kontrolka objęta nadzorem organizacji pokazuje **Managed by** i nazwę organizacji albo **Managed by your organisation**. Stałej kontrolki nie można zmienić, menu może oferować tylko część wyborów, a linia zaczynająca się od **Set by** może podać, jaka reguła obowiązuje i dlaczego. Niektóre kontrolki w ogóle nie są pokazywane.
- **Niektóre systemy projektowe są zablokowane.** System projektowy dostarczony przez organizację pokazuje kłódkę i pozostaje tylko do odczytu. Aby wypróbować zmiany, utwórz edytowalną kopię w **Settings → Preferences → Design systems**.
- **Wymienione są tylko jej narzędzia.** Narzędzie, którego organizacja nie oferuje, w ogóle nie jest pokazywane.
- **Wspólne projekty.** Jeśli organizacja udostępnia Ci projekty, **Projects** pokazuje kafelek **Team projects**. Te sesje żyją na serwerze organizacji. Otwórz jedną, aby nad nią pracować, lub rozpocznij [collab roboczy](/info/collaborate.html#work-collabs-with-lolly-work-optional) z **Share**, gdy jest dostępny.
- **Niektóre eksporty mogą wymagać zatwierdzenia.** Tam, gdzie organizacja wymaga zatwierdzenia, **Request approval** zajmuje miejsce **Download**, a narzędzie może oferować mniej formatów.

### Co gdzie zostaje

::: cols
## Na tym urządzeniu

- Twoje własne zapisy, chyba że włączysz [Sync](/info/sync.html)
- Systemy projektowe, które sam stworzyłeś
- Wszystko, co zrobisz i pobierzesz

## Na serwerze Twojej organizacji

- Tożsamość logowania i informacje o urządzeniu
- Wspólne projekty, współdzielone sesje i edycje na żywo w collabie roboczym
- Zasoby wgrywane do wspólnej biblioteki
- Prośby o zatwierdzenie i zatwierdzone dostarczenia
- Zdarzenia użycia, jeśli organizacja je włącza
:::

[Privacy](/info/privacy.html#organisation-services-with-lolly-work) wymienia, co serwer przechowuje i kto kontroluje te dane.

## Co dodaje Lolly Work

Serwer Twojej organizacji uruchamia **Lolly Work**, oprogramowanie organizacyjne tego samego projektu open source. Aplikacja nie potrzebuje ani konta Work, ani Lolly Work, gdy używasz jej samodzielnie.

::: details Co może dodać Lolly Work
Twoja organizacja hostuje [Lolly Work](https://github.com/lolly-tools/lolly-work) obok Lolly i wybiera, które funkcje włączyć:

- **Logowanie i dostęp.** Jednokrotne logowanie organizacji, uprawnienia oparte na grupach i zarządzane pola profilu. Administratorzy mogą tworzyć i dezaktywować konta przez SCIM.
- **Wspólna praca.** Wspólne projekty, współdzielone sesje i [collaby robocze](/info/collaborate.html#work-collabs-with-lolly-work-optional), z edycją na żywo przez serwer organizacji.
- **Wspólna biblioteka zasobów.** Wgrane zasoby, kolekcje i połączone biblioteki, z regułami dostępu, wersjami i przeglądem.
- **Przegląd i dostarczanie.** Kroki zatwierdzania, zarządzane linki z wygaśnięciem lub unieważnieniem oraz dostarczanie do miejsc dozwolonych przez organizację.
- **Administracja.** Raportowanie użycia według polityki telemetrii instancji oraz zapis audytu działań objętych nadzorem.

Jeśli konfigurujesz usługę, zacznij od [Deployment](/info/deployment.html#organisation-services-with-lolly-work). Publiczne demo pod [lolly.work](https://lolly.work) to piaskownica; do pracy, którą chcesz zachować, użyj własnego adresu organizacji.
:::

## Opuszczanie

**Leave** na karcie **Lolly instance** w **Settings** usuwa system projektowy, narzędzia i katalog Twojej organizacji. Twoja własna praca zostaje. Wszystko, co zrobiłeś jej narzędziami, nie otworzy się ponownie, dopóki się nie połączysz.

Wszystko, co zapisałeś w organizacji, zostaje przy organizacji, według jej zasad dostępu i retencji. Opuszczenie lub wyczyszczenie tego urządzenia nie usuwa tej kopii na serwerze. W przeglądarce pod własnym adresem organizacji nie ma czego opuszczać: otwórz zamiast tego inny adres.

## Kogo pytać

To, co dociera do serwera twojej organizacji, kto może zobaczyć jej współdzielone projekty i które ustawienia są ustalone na stałe, to decyzje twojej organizacji. Zapytaj osobę, która prowadzi Lolly w twojej organizacji. [Prywatność](/info/privacy.html) opisuje, co Lolly samo robi z twoimi danymi.
