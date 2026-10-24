# Profile

Ustaw raz swoje imię i nazwisko, dane kontaktowe i zdjęcie, a każde narzędzie zbudowane, by z nich korzystać, wypełni je za Ciebie: podpis e-mail, identyfikator, karta prelegenta. Ten mały zapis to Twój **profil** i żyje na Twoim urządzeniu.

Twój profil przechowuje też to, co gromadzisz w trakcie pracy: zapisane sesje, wgrane obrazy i lokalny licznik aktywności. Zarządzasz nim w **Settings → Preferences**; narzędzia czytają tylko pola, które zbudowano do wstępnego wypełniania. Samodzielne użycie nie wymaga konta, a opcjonalny Sync, udostępnianie i usługi organizacji mają każde własne przepływy danych, opisane poniżej.

## Co zawiera profil

| Część | Czym jest |
|---|---|
| **Name** | Imię i nazwisko. |
| **Contact** | E-mail i telefon. |
| **Location** | Miasto i kraj. |
| **Headshot** | Opcjonalne zdjęcie, przycięte do kwadratu i zachowane jako lokalny obraz, dla narzędzi takich jak podpisy e-mail, karty cytatów i schematy organizacyjne. |
| **Use my details to create** | Jeden przełącznik zgody (po włączeniu brzmi **Using my details**). Decyduje, czy Twoje dane podróżują jako podpis autora w wyeksportowanych plikach i w przebiegach Batch. Nie wpływa na wstępne wypełnianie; zobacz [How tools use your profile](#how-tools-use-your-profile). |
| **Preferences** | Twój motyw, ustawienia dostępności i to, które części aplikacji włączyłeś w **Feature flags**. |
| **Your work** | Zapisane sesje z miniaturami, uporządkowane w [Projects](/info/find-your-work.html), Twoje wgrane obrazy i lokalne statystyki aktywności. |

Nic z tego nie jest wymagane. Pusty profil działa; wypełnij tylko to, co oszczędza Ci pisania.

![Settings na karcie Preferences: szyna ustawień oraz Your details z przełącznikiem Use my details to create i polami imienia, kontaktu i lokalizacji](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Settings](/info/dashboard.html) mapuje wszystko inne w Preferences, od wyglądu i emoji po pamięć i pobrania offline.

## Ty, zespół lub rola

Słowo "profil" sugeruje jedną stałą osobę. W Lolly jest bliższe kontekstowi tworzenia: kim jesteś, gdy robisz tę rzecz. Może przybrać trzy kształty, a Lolly obsługuje każdy tak samo.

::: cols
## Jako Ty

Domyślnie. Twoje imię i nazwisko, e-mail, zdjęcie. Ustaw raz, a Twój podpis, identyfikator i znak na konferencję wypełniają się same.

## Jako zespół

Wspólna nazwa zespołu, skrzynka grupowa, taka jak `events@…`, dział i znak zespołu. Jedna osoba to ustawia i eksportuje, a wszyscy pozostali wczytują ten sam profil, więc pliki zespołu niosą spójne dane. Wspólny kiosk lub laptop demo może używać jednego profilu zespołu.

## Jako rola

Menedżer wydarzeń przez trzy dni w roku chce skrzynki wydarzenia i submarki wydarzenia na identyfikatorach i oznakowaniu, a potem swojej zwykłej tożsamości z powrotem. Trzymaj tę rolę jako zapisany plik profilu, wczytaj go na czas wydarzenia i odłóż potem.
:::

![Kontrolka zdjęcia profilowego, pusta, dopóki nie prześlesz zdjęcia, które potem pozostaje na tym urządzeniu](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Profile w organizacji używającej Lolly Work
Gdy logujesz się do [Lolly organizacji](/info/organisation.html), Lolly Work może dostarczyć zweryfikowane pola profilu od swojego dostawcy tożsamości i ustalić pola lub preferencje zgodnie z polityką organizacji. Zarządzane pole jest oznaczone w aplikacji.

To logowanie kontroluje też dostęp do wspólnych projektów i zasobów. Plik profilu zespołu to nadal plik lokalny: nie daje członkostwa w organizacji ani nie zastępuje konta Work. **Use my details to create** kontroluje podpis w Twoich eksportach, a nie logowanie ani zapisy audytu organizacji. Zobacz [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
:::

## Trzymaj kilka, używaj jednego

Instalacja ma naraz jeden aktywny profil i nie ma przełącznika w aplikacji. Zamiast tego każdy profil jest przenośnym plikiem, tym samym plikiem kopii zapasowej, którego użyłbyś do przeprowadzki na nowe urządzenie. Aby wejść w inny kontekst:

::: timeline
- <!--i:download--> **Export my data** w **Settings → Storage → Move to another device** zapisuje bieżący profil jako jeden `.zip`.
- <!--i:trash--> **Clear all my data** opróżnia tę instalację.
- <!--i:upload--> **Import data…** wczytuje plik profilu dla kontekstu, w który wchodzisz.
:::

Import bez wcześniejszego czyszczenia **scala** zamiast tego. Zaimportowane sesje i obrazy są dodawane; tam, gdzie istnieją obie kopie, zachowana jest ta zapisana później. Foldery, ulubione i szablony są dodawane obok Twoich, a Twoje dane zostają, poza pustymi polami, które przejmują wartości z pliku. To pasuje do wciągnięcia sesji jednego zespołu do Twojej konfiguracji, ale nie do czystego rozdzielenia ról.

Dla dwóch kontekstów naraz użyj osobnego profilu przeglądarki, osobnego konta użytkownika lub drugiej zainstalowanej kopii aplikacji internetowej: każda niesie własny niezależny profil Lolly.

![Dwa przyciski przenoszące całą instalację: Export my data zapisuje jeden zip, Import data odczytuje go z powrotem](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> Trzymaj jeden plik na kontekst i nazwij każdy tym, czym jest, na przykład `LollyTools-events-2026.zip` i `LollyTools-me.zip`. Plik jest profilem.

[Move your work to another device](/info/find-your-work.html#move-your-work-to-another-device) omawia, co zawiera plik, co zostaje i inne sposoby przenoszenia, w tym Sync.

## Jak narzędzia korzystają z twojego profilu

**Wstępne wypełnianie.** Autor narzędzia oznacza dane wejściowe jako czerpiące z Twojego profilu (`bindToProfile: "firstname"`, `"email"`, `"headshot"` i tak dalej). Gdy narzędzie się otwiera, te dane wejściowe wypełniają się z Twojego profilu, a możesz je nadpisać na jedną sesję bez zmiany profilu, chyba że polityka organizacji blokuje dane wejściowe. Wstępne wypełnianie to lokalna wygoda i dzieje się niezależnie od tego, czy **Use my details** jest włączone.

**Podpis autora.** Gdy eksportujesz, Twoje dane mogą podróżować jako podpis autora w metadanych pliku (PNG, PDF, SVG i inne), aby gotowy plik mógł powiedzieć, kto wykonał pracę. Rządzi tym **Use my details to create**, a także autorem w przebiegach Batch. Gdy wyłączone, eksport nadal mówi, że powstał w Lolly, i nie niesie osobistego autora ani linii kontaktowej.

Autorzy narzędzi: zobacz [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) i [`host.profile`](/info/host-api.html#host-profile).

![Jedyny przełącznik Use my details to create, oznaczony jako zgoda i wyłączony, dopóki go nie włączysz](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profil, system projektowy i możliwości

Trzy rzeczy stoją blisko siebie w Settings i łatwo je pomylić:

- <!--i:people--> **Profile** - Ty, Twój zespół lub rola, w której jesteś: imię i nazwisko, kontakt, zdjęcie i zapisana praca. Osobisty, przechowywany na urządzeniu i przenośny jako plik.
- <!--i:palette--> **Design system** - marka: kolory, czcionki i ustawienia, z którymi renderuje każde narzędzie. Wspólny i spójny, a nie osobisty; zobacz [Design System Setup](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - co potrafi aplikacja: funkcje i narzędzia dostępne dla Ciebie.

Profil zmienia to, od kogo jest plik; system projektowy zmienia to, jak plik wygląda; możliwości to to, co możesz stworzyć.

To słowo ma w Lolly trzy inne znaczenia. **Profil treści** (content profile) to ustawienie kompilacji, które wybiera, jakie narzędzia i katalog dostarcza wdrożenie; [Glossary](/info/glossary.html) definiuje ten termin. Parametr linku `profile` wybiera profil kolorów eksportu, na przykład warunki druku CMYK; zobacz [Reserved URL parameters](/info/url-parameters.html#print). **Zweryfikowana tożsamość** (verified identity) to opcjonalny certyfikat podpisujący, który wiąże Twój e-mail z podpisanymi eksportami, oddzielny od tych danych, choć **Use my details to create** decyduje, czy któryś z nich jest osadzany; zobacz [Content Credentials](/info/content-credentials-identity.html).

![Karta Verified identity, szerokość telefonu: wybór okresu ważności certyfikatu i krok rejestracji poniżej - profil tożsamości, odrębny od twoich danych osobowych](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Prywatność

Twój profil osobisty jest przechowywany lokalnie. Twoje dane mogą podróżować w kopii zapasowej lub kopii Sync, w treściach, które udostępniasz lub eksportujesz, oraz podczas opcjonalnej rejestracji Content Credentials. W instancji Lolly Work logowanie, wspólna praca, polityka telemetrii i zapisy audytu są oddzielone od tego profilu lokalnego. **Settings → Preferences → Clear all my data** czyści to urządzenie; nie usuwa kopii przechowywanych przez Twojego dostawcę magazynu ani organizację. Zobacz [Privacy Policy](/info/privacy.html).
