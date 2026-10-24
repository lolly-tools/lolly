# Jak Lolly wypada na tle innych

Lolly to dwie części jednego projektu open source. **Lolly** to silnik, aplikacje i narzędzia do tworzenia, edycji, konwersji i eksportu na Twoim urządzeniu, bez konta. **Lolly Work** to serwer organizacji, prowadzony na Twojej własnej infrastrukturze, do logowania, wspólnych projektów, zatwierdzeń i renderowania serwerowego. Oba są na MPL-2.0. Ta strona porównuje tę parę z innymi sposobami, na jakie ludzie projektują, nadzorują i tworzą pliki.

## Dzisiejsze narzędzia

Każdy pierścień ocenia, jak kompletnie klasa produktów dostarcza daną możliwość, przy czym każda klasa jest oceniana na swoim najlepszym przedstawicielu. Kolumna Lolly obejmuje Lolly i Lolly Work razem, a każdy wiersz mówi, która część co zapewnia. Otwórz nazwę wiersza, aby poznać uzasadnienie jego oceny. Kolumny są posortowane według wiersza Overall completeness na górze: średniej z ocenianych wierszy, z wyłączeniem wiersza wydatków.

::: figure positioning-comparison
Porównanie możliwości: badania konkurencji i oceny z sierpnia 2026; pokrycie Lolly + Lolly Work sprawdzone 28 września 2026. Ocenianie: 0 brak, 25 obejście, 50 prawdziwe, ale z ograniczeniami lub częściowe, 75 mocne z zastrzeżeniami, 100 podstawowa kompetencja.
:::

::: details Uwagi do oceniania
Dostępne funkcje i dojrzałość produkcyjna to osobne sprawy. Lolly jest wydane: wersja 1.0 ukazała się jako open source 30 sierpnia 2026, jego bezpieczeństwo nie przeszło jeszcze niezależnego audytu, a dowody wdrożeń mają kilka miesięcy ([Adoption & Governance](/info/adoption-governance.html#status) podaje bieżący stan). Posiadanie jednokrotnego logowania, zatwierdzeń czy renderowania serwerowego nie ustanawia historii produkcyjnej, więc ocena dojrzałości to odzwierciedla. Oceny konkurentów zachowują swój datowany przegląd z sierpnia.

Jedna reguła rządzi tablicą. Pełne punkty (100) w wierszach dotyczących Twojej treści lub tożsamości wymagają możliwości, której można użyć bez konta i bez warunku chmury; wiersze o samym produkcie, takie jak dojrzałość i łatwość użycia, są z tego wyłączone. Ta reguła kosztuje Adobe w Content Credentials: najszersza dostarczona implementacja (Photoshop, Lightroom, Premiere, Firefly) podpisuje lokalnie i w chmurze, ale nigdy bez konta i tożsamości Adobe, więc 75. Z tego samego powodu ogranicza API renderujące w masowym generowaniu i automatyzacji.

Canva jest oceniana na swoim najlepszym członku rodziny w każdym wierszu, ponieważ posiada Affinity i Cavalry (oba rozdane w październiku 2025). Renderowanie offline i na urządzeniu dostaje 75 przez Affinity, pakiet komputerowy, który nadal potrzebuje zweryfikowanego konta i niesie telemetrię, co Adobe też odlicza; własny tryb offline Canva edytuje tylko wstępnie zsynchronizowane projekty, na jednym urządzeniu, przez ograniczone okno. Autofill dostaje 50: jest prawdziwy, ale zamknięty w Enterprise i asynchroniczny, a wypełnia tylko tekst i obrazy. Masowe generowanie w Figma wzrosło z 25 do 50, gdy Buzz dostarczył wypełnianie z arkusza (darmowa beta, sierpień 2026).

Ocena 75 Content Credentials w Lolly obejmuje podpisywanie na urządzeniu i podpisywanie serwerowe Lolly Work ze skonfigurowaną tożsamością organizacji; weryfikator nadal musi zaufać podpisującemu ([Content Credentials Identity](/info/content-credentials-identity.html)). 50 Penpot pochodzi z własnej wtyczki eksportu Lolly dla Penpot: to samo podpisywanie silnika, opcjonalne i ujawnione jako Lolly. Penpot dostaje 90 w renderowaniu na urządzeniu: kanwa przeglądarki z celem zapisu na jego serwerze, który można hostować samodzielnie. Cloudinary dostaje własną kolumnę za bibliotekę zasobów, API transformacji i CDN; sierpniowy przegląd ocenił jego podpisywanie dostarczania na 50.

Współpraca na żywo w Lolly obejmuje bezpośrednie prywatne collaby dwóch urządzeń i uwierzytelniane collaby robocze przez Lolly Work, ze wspólnymi edycjami, kursorami i zapisanymi sesjami zespołu. Ocena Partial odzwierciedla obecne wdrożenie pracy na jednym węźle i krótką historię działania, a nie brak edycji zespołowej. Szacunki cen to datowana arytmetyka cen katalogowych dla skali, a nie zamówienie.
:::

## Kiedy sięgnąć po Lolly

::: cols
## Sięgnij po Lolly, gdy

- Ten sam rodzaj pliku jest potrzebny raz po raz: kafle wydarzeń, identyfikatory, certyfikaty, alerty, karty do mediów społecznościowych
- Wiele plików powstaje z jednego szablonu i tabeli wartości, w [Batch](/info/batch.html#make-many-versions-of-one-design) lub CLI
- Kolory, typografia i zasoby muszą pozostać w obrębie systemu projektowego, nawet na otwartej kanwie
- Gotowy projekt z Figmy, Penpot, Illustratora, InDesign lub PDF ma stać się edytowalny i powtarzalny ([Import a design](/info/design-import.html))
- Pliki muszą powstawać na Twoich własnych urządzeniach lub serwerach

## Sięgnij po coś innego, gdy

- Praca to szczegółowa retusz zdjęć lub ilustracja
- Projektujesz i prototypujesz interfejs aplikacji
- Potrzebujesz dużej biblioteki zdjęć stockowych i szablonów gotowej od pierwszego dnia
- Potrzebujesz zarządzanej usługi z długą historią w dużej skali
:::

Zaimportowane projekty i wspólne tokeny projektowe pozwalają zespołowi łączyć Lolly ze specjalistycznymi aplikacjami, podczas gdy Lolly Work nadzoruje wspólne zasoby, przegląd i dostarczanie.

Cała prezentacja pokazuje sufit: w **Markdown Slides** prezentacja jest deklarowana jako dane, układana na żywo i eksportowana jako natywny, edytowalny plik PowerPoint.

![Markdown Slides w widoku podzielonym: slajdy prezentacji wymienione jako bloki po lewej, ułożona prezentacja renderowana po prawej](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Reguły żyją w narzędziu

Lolly umieszcza w narzędziu reguły marki wielokrotnego użytku: kolory, czcionki, spady, odstępy i dozwolone dane wejściowe. Szablon utrwala części, których odbiorca nie może zmieniać. Lolly Work dodaje wokół tego szablonu dostęp grupowy i polityki danych wejściowych, z łańcuchami zatwierdzeń dla zgłoszeń do katalogu i dostarczania.

Jednorazowe sprawdzenie narzędzia ułatwia powtarzalną produkcję, ponieważ każdy wynik dziedziczy jego reguły układu. Treść, wgrane obrazy i prawa użycia nadal mogą wymagać sprawdzenia, a Lolly Work zapewnia do tego wspólne katalogi i kroki zatwierdzania. Dla zespołu kreatywnego narzędzie to bariera ochronna: nadal wnosisz dane, tekst i obraz, a narzędzie utrzymuje każdy wynik zgodny z marką.

![Cała praca producenta: wpisać słowa. Typografia, kolor i odstępy zostały ustalone, gdy narzędzie powstawało](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Trzy kolejne rzeczy wyróżniają to podejście:

- **Gotowy plik z danych wejściowych.** Dane wchodzą, gotowy plik wychodzi, bez "teraz zapisz to z narzędzia projektowego i popraw".
- **Narzędzia składają narzędzia.** Jedno narzędzie może osadzić render innego w jednym gotowym pliku, bez sprzężenia kodu między nimi.
- **Otwarte na wskroś.** Silnik jest open source, a narzędzia, zasoby i tokeny projektowe to pliki, które możesz trzymać w kontroli wersji lub zarządzać w Lolly Work, a nie wiersze w cudzej bazie danych.

Odważny projekt przeżywa bariery ochronne. Ta mapa miasta klasy plakatowej to prawdziwe wektorowe ścieżki dróg i wody, z listy rozwijanej i dwóch pól koloru, których nie da się skierować poza system projektowy:

![Pierścienie kanałów i sieć dróg Amsterdamu narysowane od krawędzi do krawędzi własnym atramentem systemu projektowego, każda kreska ustawiona przez szablon, a nie ręcznie](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Innowacja probabilistyczna, skala deterministyczna

Większość pomysłów "kreatywnego AI" stawia model po złej stronie starej linii. Skrybowie i iluminatorzy ustalili, gdzie ona biegnie. Pracujesz swobodnie nad szkicem, gdzie wszystko można wypróbować i nic nie jest zobowiązaniem. Potem idziesz do prasy drukarskiej, która zobowiązuje. Szkice były miejscem, w którym była sztuka, a prasa tym, jak podróżowała, a drukowanemu dziełu można było ufać, ponieważ prasa dotrzymywała obietnicy przy każdym odbitce.

Lolly jest prasą. Przynieś do pomysłów, co chcesz, model, projektanta lub szybki rysunek, ale w chwili, gdy pomysł ma stać się wieloma plikami, przechodzi przez coś, co renderuje tak samo za każdym razem, z danych wejściowych, które każdy może odczytać. Powyższe porównanie dotyczy naprawdę tego, kto czyni ten zobowiązujący krok powtarzalnym.

> Ufaj procesowi twórczemu, skaluj z rygorem.

## Za darmo na zawsze

**Jeśli renderuje się na Twoim urządzeniu, jest za darmo na zawsze.** Silnik, powłoki, narzędzia i formaty są open source, a wydana wersja nie może zostać cofnięta. Lolly Work też jest open source. Organizacja płaci za infrastrukturę i obsługę, które wybierze, bez opłaty licencyjnej za stanowisko ani za renderowanie przy samodzielnym hostowaniu. [Questions & answers](/info/faq.html) opowiada historię za tą obietnicą.

## Gdzie żyje Twoja treść

Twórcza praca w Lolly może działać na sprzęcie, który posiadasz, a jej tokeny projektowe, czcionki, logo i narzędzia to pliki, które możesz zachować. W Lolly Work wspólne projekty, zasoby, polityki i zapisy audytu żyją w magazynie skonfigurowanym przez Twoją organizację. [Trust](/info/trust.html) wyjaśnia, dlaczego to ma znaczenie, a [Privacy Policy](/info/privacy.html) i [Verify It Yourself](/info/verify-yourself.html) pozwalają sprawdzić twierdzenie, zamiast wierzyć nam na słowo.

## Narzędzie po narzędziu

[Lolly compared, tool by tool](/info/compare.html) porównuje Lolly z Canva, Adobe, Figma, Penpot, portalami marek, API renderującymi i internetowymi konwerterami, po jednej stronie na każdy, i opisuje [what runs where](/info/compare.html#what-runs-where).
