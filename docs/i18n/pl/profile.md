# Profile

Ustaw raz imię i nazwisko, dane kontaktowe oraz zdjęcie portretowe, a każde narzędzie przystosowane do ich używania wypełni je automatycznie, na przykład podpis e-mailowy, identyfikator lub kartę prelegenta. Ten zestaw danych to Twój **profil**, który znajduje się na Twoim urządzeniu.

Twój profil zawiera też zapisane sesje, przesłane obrazy i lokalne statystyki aktywności. Zarządzaj nim w **Settings → Preferences**. Narzędzia odczytują tylko pola, do których wstępnego wypełniania zostały przystosowane. Samodzielne używanie nie wymaga konta. Opcjonalne Sync, udostępnianie i usługi organizacji mają własne przepływy danych.

<!--i:eti-user-check-->
## Co zawiera profil

| Część | Co to jest |
|---|---|
| **Name** | Imię i nazwisko. |
| **Contact** | E-mail i telefon. |
| **Location** | Miasto i kraj. |
| **Headshot** | Opcjonalne zdjęcie, przycięte do kwadratu i przechowywane jako lokalny obraz, dla narzędzi takich jak podpisy e-mailowe, karty cytatów i schematy organizacyjne. |
| **Use my details to create** | Przełącznik wymagający świadomego włączenia, po którym zmienia etykietę na **Using my details**. Określa, czy Twoje dane są dołączane jako dane autora do eksportowanych plików i uruchomień Lolly Batch; zobacz [Jak narzędzia używają Twojego profilu](#how-tools-use-your-profile). |
| **Preferences** | Twój motyw, wariant kolorystyczny w każdym systemie projektowym, ustawienia dostępności i części aplikacji włączone w **Feature flags**. |
| **Your work** | Zapisane sesje z miniaturami, uporządkowane w [Lolly Projects](/info/find-your-work.html), przesłane obrazy i lokalne statystyki aktywności. |

Żadne z tych danych nie są wymagane, a pusty profil działa.

![Settings na karcie Preferences: pasek ustawień oraz Your details z przełącznikiem Use my details to create i polami imienia i nazwiska, kontaktu oraz lokalizacji](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Ustawienia Lolly](/info/dashboard.html) opisują pozostałe opcje Preferences, od wyglądu i emoji po przechowywanie i pobieranie do pracy offline.

<!--i:eti-users-->
## Ty, zespół lub rola

W Lolly profil określa, kim jesteś podczas tworzenia: sobą, zespołem lub osobą w określonej roli. Lolly obsługuje wszystkie trzy przypadki tak samo.

::: cols
## Jako Ty

Domyślnie: Twoje imię i nazwisko, e-mail i zdjęcie portretowe. Wypełniają one Twój podpis, identyfikator i kompozycję znaków konferencyjnych.

## Jako zespół

Wspólna nazwa zespołu, grupowa skrzynka odbiorcza, taka jak `events@…`, dział i znak zespołu. Jedna osoba konfiguruje profil i eksportuje plik. Pozostali wczytują ten sam profil, więc pliki zespołu zawierają te same dane. Współdzielony kiosk lub laptop demonstracyjny może korzystać z jednego profilu zespołu.

## W określonej roli

Organizator wydarzenia potrzebuje skrzynki wydarzenia i submarki na identyfikatorach i oznakowaniu przez trzy dni w roku, a potem wraca do zwykłej tożsamości. Zachowaj rolę jako zapisany plik profilu, wczytaj go na wydarzenie i odłóż po jego zakończeniu.
:::

![Kontrolka zdjęcia portretowego, pusta do czasu przesłania zdjęcia, które potem pozostaje na tym urządzeniu](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Profile w organizacji korzystającej z Lolly Work
Gdy logujesz się do [Lolly organizacji](/info/organisation.html), Lolly Work może dostarczyć zweryfikowane pola profilu od swojego dostawcy tożsamości i zablokować pola lub preferencje zgodnie z zasadami organizacji. Zarządzane pole jest oznaczone w aplikacji.

To logowanie kontroluje też dostęp do współdzielonych projektów i zasobów. Plik profilu zespołu jest plikiem lokalnym. Nie nadaje członkostwa w organizacji ani nie zastępuje konta służbowego. **Use my details to create** kontroluje dane autora w eksportach, a nie logowanie do organizacji czy zapisy audytu. Zobacz [Prywatność](/info/privacy.html#organisation-services-with-lolly-work).
:::

<!--i:eti-copy-->
## Zachowaj kilka, używaj jednego

Instalacja ma jeden aktywny profil naraz, bez przełącznika w aplikacji. Każdy profil to przenośny plik, ten sam plik kopii zapasowej, który przenosi Twoją pracę na nowe urządzenie. Aby zmienić kontekst:

::: timeline
- <!--i:download--> **Export my data** w **Settings → Storage → Move to another device** zapisuje bieżący profil jako jeden plik `.zip`.
- <!--i:trash--> **Clear all my data** opróżnia tę instalację.
- <!--i:upload--> **Import data…** wczytuje plik profilu dla kontekstu, do którego przechodzisz.
:::

::: note Import bez wcześniejszego wyczyszczenia scala dane
Importowane sesje i obrazy są dodawane. Gdy istnieją obie kopie, zachowywana jest ta zapisana później. Foldery, ulubione i szablony są dodawane obok Twoich. Twoje dane pozostają, z wyjątkiem pustych pól, które przyjmują wartości z pliku. Scalanie nadaje się do włączenia sesji zespołu do Twojego środowiska, ale nie do wyraźnego oddzielenia ról.
:::

Aby używać dwóch kontekstów naraz, użyj osobnego profilu przeglądarki, konta użytkownika lub zainstalowanej kopii aplikacji webowej. Każde z nich ma własny profil Lolly.

![Dwa przyciski przenoszące całą instalację: Export my data zapisuje jeden plik zip, Import data wczytuje go z powrotem](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

::: note Zachowaj jeden plik na kontekst
Nadaj każdemu plikowi nazwę odpowiadającą jego zawartości, na przykład `LollyTools-events-2026.zip` i `LollyTools-me.zip`. Plik jest profilem.
:::

[Przenoszenie pracy na inne urządzenie](/info/find-your-work.html#move-your-work-to-another-device) opisuje zawartość pliku, to, co pozostaje, i inne sposoby przenoszenia, w tym Sync.

<!--i:eti-pen-->
## Jak narzędzia używają Twojego profilu

**Wstępne wypełnianie.** Autor narzędzia oznacza dane wejściowe jako pobierane z Twojego profilu (`bindToProfile: "firstname"`, `"email"`, `"headshot"` i tak dalej). Gdy narzędzie się otwiera, te dane wejściowe są wypełniane z Twojego profilu. Możesz nadpisać wartość dla jednej sesji bez zmiany profilu, chyba że zasady organizacji blokują dane wejściowe. Wstępne wypełnianie odbywa się lokalnie, niezależnie od tego, czy **Use my details** jest włączone.

**Dane autora.** Gdy eksportujesz, Twoje dane mogą zostać dołączone jako dane autora w metadanych pliku (PNG, PDF, SVG i innych). **Use my details to create** kontroluje te dane oraz autora w uruchomieniach Lolly Batch. Przy wyłączonym przełączniku eksport nadal informuje, że powstał w Lolly, ale nie zawiera osobistych danych autora ani danych kontaktowych.

Autorzy narzędzi: zobacz [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) i [`host.profile`](/info/host-api.html#host-profile).

![Jeden przełącznik Use my details to create, oznaczony jako wymagający świadomego włączenia i wyłączony, dopóki go nie włączysz](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

<!--i:eti-layers-->
## Profil, system projektowy i możliwości

Trzy rzeczy znajdują się blisko siebie w Settings i łatwo je pomylić:

- <!--i:people--> **Profile** - Ty, Twój zespół lub Twoja rola: imię i nazwisko, dane kontaktowe, zdjęcie portretowe i zapisana praca. Osobisty, przechowywany na urządzeniu i przenośny jako plik.
- <!--i:palette--> **Design system** - marka: kolory, czcionki i ustawienia, z którymi renderuje każde narzędzie. Wspólny, nie osobisty; zobacz [Konfiguracja systemu projektowego Lolly](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - co aplikacja potrafi: dostępne dla Ciebie funkcje i narzędzia.

To słowo ma w Lolly jeszcze trzy znaczenia. **Profil treści** to ustawienie budowania określające, jakie narzędzia i katalog zawiera wdrożenie; [Słownik](/info/glossary.html) definiuje ten termin. Parametr linku `profile` wybiera profil kolorów dla eksportu, na przykład warunki druku CMYK; zobacz [Zarezerwowane parametry URL](/info/url-parameters.html#print). **Zweryfikowana tożsamość** to opcjonalny certyfikat podpisujący, który wiąże Twój e-mail z podpisanymi eksportami. Jest oddzielony od tych danych, ale **Use my details to create** określa, czy którekolwiek z nich są osadzane; zobacz [Content Credentials](/info/content-credentials-identity.html).

![Karta Verified identity przy szerokości telefonu: selektor okresu ważności certyfikatu i krok rejestracji pod nim - profil tożsamości, oddzielony od Twoich danych osobistych](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

<!--i:eti-lock-->
## Prywatność

Twój osobisty profil jest przechowywany lokalnie. Twoje dane mogą być przenoszone w kopii zapasowej lub kopii Sync, w udostępnianych lub eksportowanych treściach i podczas opcjonalnej rejestracji Content Credentials. W instancji Lolly Work logowanie, wspólna praca, zasady telemetrii i zapisy audytu są oddzielone od tego lokalnego profilu. **Settings → Preferences → Clear all my data** czyści to urządzenie; nie usuwa kopii przechowywanych przez dostawcę miejsca przechowywania lub organizację. Zobacz [Politykę prywatności](/info/privacy.html).
