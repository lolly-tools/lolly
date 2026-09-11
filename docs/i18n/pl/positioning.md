# Jak Lolly wypada na tle innych

To, co Lolly robi, a czego dzisiejsze narzędzia kreatywne nie robią, oraz to, co celowo pozostawia im.

Wersję porównującą narzędzie po narzędziu, po jednej stronie dla Canvy, Adobe, Figmy, API do renderowania i konwerterów online, znajdziesz w [Lolly na tle innych, narzędzie po narzędziu](/info/compare.html). Każda strona podaje, co dane narzędzie robi lepiej i co Lolly robi zamiast tego.

> **Status pilotażu:** Lolly to prototyp w zamkniętym pilotażu, nie gotowy produkt, a jego bezpieczeństwo przechodzi obecnie rygorystyczne utwardzanie infrastruktury przez SUSE, przygotowujące do skali korporacyjnej. Strona [Adoption & Governance](/info/adoption-governance.html#status) opisuje bieżący stan.

## Dzisiejsze narzędzia

Każdy pierścień poniżej ocenia, jak w pełni dana klasa produktu dostarcza daną możliwość **w obecnie dostarczanej postaci** - nie tak, jak jest marketowana - a każda klasa oceniana jest po swoim najlepszym przedstawicielu. Lolly oceniane jest tym samym nożem: bierze jedyny czerwony pierścień na planszy, za dojrzałość. Otwórz nazwę wiersza, by zobaczyć uzasadnienie ocen. Kolumny są posortowane według wiersza Overall completeness u góry - średniej z ocenianych wierszy, z pominięciem wiersza wydatków.

::: figure positioning-comparison
Kompletność możliwości w dzisiejszych narzędziach kreatywnych, na podstawie badania z sierpnia 2026. Punktacja: 0 brak, 25 na poziomie obejścia, 50 realne, ale ograniczone lub częściowe, 75 mocne z zastrzeżeniami, 100 kluczowa kompetencja.
:::

**Uwagi do oceny.** Oceny Lolly zakładają, że jego opublikowane deklaracje się utrzymują, dlatego dojrzałość jest jego jedynym czerwonym pierścieniem: zamknięty pilotaż, utwardzanie bezpieczeństwa w toku, nic jeszcze nieaudytowane. Research przeniósł kilka komórek.

Canva jest oceniana po najlepszym członku swojej rodziny produktów w każdym wierszu, ponieważ posiada Affinity i Cavalry (oba oddane za darmo w październiku 2025). Renderowanie offline i na urządzeniu ocenia się na 75 dzięki Affinity - pakietowi desktopowemu, który nadal wymaga zweryfikowanego konta i niesie telemetrię, co jest tym samym odliczeniem, jakie ponosi też Adobe - podczas gdy własny tryb offline Canvy edytuje wyłącznie wcześniej zsynchronizowane projekty, na jednym urządzeniu, w ograniczonym oknie czasowym. Autofill ocenia się na 50: realny, ale zablokowany za Enterprise, asynchroniczny, tylko tekst i obraz. Masowa generacja w Figmie wzrosła z 25 do 50, gdy Buzz wprowadził wypełnianie z arkusza kalkulacyjnego (darmowa beta, sierpień 2026).

Planszą rządzi jedna zasada: pełny wynik (100) w wierszach dotykających Twojej treści lub tożsamości wymaga możliwości, z której możesz skorzystać bez konta i bez warunku chmury; wiersze opisujące sam produkt (dojrzałość, łatwość użycia) są z tego zwolnione. Kosztuje to Adobe punkty przy proweniencji: najszersze wdrożone C2PA (Photoshop, Lightroom, Premiere, Firefly) podpisuje lokalnie i w chmurze, ale nigdy bez konta Adobe i tożsamości, stąd 75. Ta sama zasada ogranicza API do renderowania w masowej generacji i automatyzacji.

Wynik 75 dla proweniencji Lolly odzwierciedla podpisywanie offline na urządzeniu: architektonicznie silniejsze, ale nieaudytowane, a klucz urządzenia w standardowych walidatorach odczytywany jest jako niezweryfikowany, dopóki nie poręczy za niego tożsamość lub własny CA organizacji. 50 punktów Penpota pochodzi z oficjalnej wtyczki Lolly Export: to samo podpisywanie silnikiem, opcjonalne, ujawnione jako własność Lolly. Penpot bierze też jedyny na planszy pierścień poza skalą, 90 w renderowaniu na urządzeniu - płótno w przeglądarce, zapis do własnej suwerennej chmury (nawet laptopa), prywatny eksport; jedynie przeskok przez serwer odróżnia go od Lolly. Cloudinary otrzymuje własną kolumnę: to potok medialny (DAM, API do transformacji, CDN), i jedyna kolumna chmurowa dostarczająca C2PA (50, ponieważ fl_c2pa podpisuje przy dostarczeniu, poświadczając delivered-by-Cloudinary, a nie made-by-you).

Współpraca na żywo działa w drugą stronę: Figma wyznacza benchmark skali (200 edytorów), a parami, odseparowana P2P Lolly ocenia się jako Partial. Cena to szacunek, oznaczony jako taki: arytmetyka cen katalogowych na realistycznych mieszankach miejsc, celowo szeroka, dla obrazu skali, nie zamówień publicznych. API do renderowania biorą 75 przy ograniczeniach: szablony zablokowane, brak warstwy governance marki.

Luka: nic dostarczanego dziś nie jest jednocześnie constraints-first i offline, bez konta i bez serwera na ścieżce renderowania, i nikt nie skopiował klauzuli o koncie. Lolly ma teraz własne otwarte płótno - **Design**, płótno bezpośredniej manipulacji - ale kolory, typografia i zasoby na nim podlegają globalnym ustawieniom marki, więc nawet swobodna kompozycja pozostaje constraints-first.

Tym, czym Lolly wciąż **nie jest**, to nieograniczony pakiet projektowy; projektanci nadal będą używać Illustratora i Figmy do prac autorskich - a gdy taka praca musi stać się zarządzanym, odtwarzalnym zasobem, funkcja narzędzia Design [Import a design](/info/design-import.html) przenosi gotowy plik z Figmy, Penpota, Illustratora, InDesigna lub PDF na płótno jako edytowalne, zgodne z marką bloki.

![Otwarte płótno Design, na którym dostępne kolory, kroje pisma i zasoby są własnością marki](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&dark=1&filename=aud-open-canvas)

## Do czego tego używać

- Szybkie generowanie operacjonalizowanych zasobów kreatywnych (kafelki wydarzeń, odznaki, sygnatury, alerty)
- Swobodna kompozycja na otwartym płótnie (Design), gdy elementy - kolory, typografia, ikony, obrazy - muszą pozostać zgodne z globalnymi ustawieniami marki
- Wprowadzanie gotowego projektu z Figmy, Penpota, Illustratora, InDesigna lub PDF (funkcja Import a design narzędzia Design), tak by można go było edytować, zarządzać nim i deterministycznie ponownie renderować w każdym formacie Lolly
- Przepływy typu jeden-do-wielu „wypełnij trzy pola, otrzymaj gotowy zasób” - w tym uruchomienia masowe z arkusza kalkulacyjnego/CSV w siatce wsadowej `/pro` (wklej lub zaimportuj wiersze, jeden gotowy zasób na wiersz, pobierz jako zip)
- Stale dostępne, powtarzalne markowe treści
- Sytuacje, w których centralna kontrola nad wyrazem marki liczy się bardziej niż elastyczność ekspresji

Deck Studio dobrze pokazuje tu sufit możliwości: cała prezentacja slajdów zadeklarowana jako dane, ułożona na żywo na płótnie i wyeksportowana jako natywny, edytowalny plik PowerPoint.

![Deck Studio w widoku podzielonym - slajdy prezentacji wymienione jako bloki po lewej, wyrenderowana prezentacja po prawej](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Do czego tego nie używać

- Autorskiej lub flagowej treści hero (billboardy, główne materiały wideo)
- Unikalnej pracy kampanijnej, która naprawdę wymaga projektanta
- Ideacji, która musi całkowicie wyjść poza system marki - otwarte płótno Lolly nadal podporządkowuje kolory, typografię i zasoby globalnym ustawieniom marki, i o to właśnie chodzi

## Innowacja probabilistyczna, skala deterministyczna

Większość pitchów „AI creative” stawia model po niewłaściwej stronie starej granicy. Skrybowie i iluminatorzy już dawno ustalili, gdzie ona przebiega: pracujesz swobodnie na szkicu, gdzie można spróbować wszystkiego i nic nie jest jeszcze przesądzone, a potem idziesz do prasy drukarskiej, która budzi respekt właśnie dlatego, że przesądza. To w szkicach była sztuka. Prasa była tym, jak ta sztuka trafiała dalej. Dwa narzędzia, dwa zadania, każde twórcze na swój sposób, a drukowanemu dziełu można było zaufać, ponieważ prasa dotrzymywała obietnicy przy każdym odbiciu.

Lolly jest prasą, nie szkicem. Przynieś do ideacji, co chcesz - model, projektanta, serwetkę - ale w chwili, gdy pomysł musi stać się dziesięcioma tysiącami zasobów, przechodzi przez coś, co renderuje się tak samo za każdym razem, z danych wejściowych, które każdy może odczytać wstecz. O to naprawdę chodzi w powyższym porównaniu: nie o to, kto ma lepszy generator, lecz o to, kto czyni ten przesądzający krok odtwarzalnym.

> Ufaj procesowi twórczemu, skaluj z rygorem.

## Zatwierdzaj narzędzie, nie plik

Każde inne narzędzie na rynku produkuje *plik*, który potem trzeba sprawdzić - menedżer marki na wątku Slacka, dział prawny sprawdza zastrzeżenia, runda poprawek, kolejna weryfikacja. Lolly przesuwa zatwierdzenie **o krok wcześniej**. Zasady marki - dokładne kody hex, licencjonowane pliki czcionek, marginesy na spad, odstępy - są zakodowane na sztywno w HTML i CSS narzędzia, więc szablon *nie może* wygenerować zasobu niezgodnego z marką. Sam układ egzekwuje te zasady.

Dzięki temu przestajesz zatwierdzać wyniki, a zaczynasz zatwierdzać **narzędzie**, które je tworzy. Zatwierdzasz je raz, a każdy zasób, który kiedykolwiek wyprodukuje, jest z góry zatwierdzony z definicji - bez człowieka w pętli, bez cyklu recenzji, przy dowolnej skali.

To jest zmiana, którą faktycznie wprowadza deterministyczny silnik: to nie szybsza wersja starego procesu zatwierdzania, tylko usunięcie tego procesu. Dla zespołu kreatywnego to bariera ochronna, nie zamiennik - nadal rzucasz piłkę (dane, tekst, obraz), a kod jest torem odbojowym, który nie pozwala żadnemu rzutowi wypaść poza rynnę.

![Cała praca producenta: wpisać słowa. Krój, kolor i odstępy zostały ustalone w momencie zatwierdzenia narzędzia](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DApproved&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-approve-the-tool)

| Zatwierdzanie zasobów po staremu | Zatwierdzanie narzędzia, po lollowemu |
|---|---|
| Każdy gotowy plik jest sprawdzany, jeden po drugim | Narzędzie jest sprawdzane raz |
| Prośba → projektant tworzy → weryfikacja marki → sprawdzenie prawne → poprawki → ponowna weryfikacja | Jedna zmiana parametru → gotowy zasób |
| Projektant, menedżer marki, dział prawny i zleceniodawca w jednej pętli | Producent, samodzielnie |
| Dni na jeden zasób | Sekundy na jeden zasób |
| 10 000 zasobów = 10 000 cykli recenzji | 10 000 zasobów = zero (szablon był już zatwierdzony) |

## Co to daje wyjątkowo

- **Odważny potencjał projektowy dostarczany bezpiecznie w kontekście.** Narzędzia mogą wyrażać śmiałe pomysły projektowe wewnątrz sztywno zakodowanych barier ochronnych.

- **Automatyzacja treści zdefiniowana programowo, która zwraca gotowy zasób.** Dane wejściowe → gotowy plik. Żadnego "teraz zapisz to z narzędzia projektowego i przetwórz ręcznie".
- **Narzędzia łączą narzędzia.** Jedno narzędzie może osadzić render innego narzędzia i zwrócić go jako część jednego gotowego zasobu, bez sprzężenia kodu między narzędziami - prymityw, którego nie oferuje żaden produkt typu otwarte płótno czy szablonowanie DAM na rynku.
- **Neutralność względem dostawcy.** Pełna kontrola nad funkcjami i kosztami. Silnik open source. Narzędzia i zasoby to treść śledzona w git, a nie dane zamknięte w bazie SaaS.

Pierwszy z tych punktów jest ten, który ludzie najbardziej niedoceniają. Mapa miasta w jakości plakatowej, narysowana jako prawdziwe wektorowe ścieżki dróg i wody, z listy rozwijanej i dwóch pól koloru, których nie da się skierować poza markę:

![Amsterdamskie pierścienie kanałów i sieć dróg narysowane od krawędzi do krawędzi w barwach marki, każde pociągnięcie umieszczone przez szablon, a nie ręcznie](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Suwerenność treści

Jest nazwa na to, do czego sprowadza się poprzednia sekcja: suwerenność. Twój potok mediów działa na sprzęcie, który posiadasz. Twoja marka - tokeny, czcionki, logotypy, narzędzia, które je egzekwują - żyje w plikach, które trzymasz, w systemie kontroli wersji, który kontrolujesz, a nie w bazie danych dostawcy z przyciskiem eksportu. Renderowanie odbywa się na urządzeniu, które masz przed sobą, więc zasób nigdy nie musi przejść przez stronę trzecią, żeby powstać, a cała droga od danych wejściowych do gotowego pliku jest open source i możliwa do sprawdzenia. Gdyby jutro zniknęli wszyscy dostawcy SaaS do projektowania, wdrożenie Lolly by tego nie zauważyło.

To ma znaczenie dla każdego, czyja praca powinna przetrwać dłużej niż subskrypcja: dla rodzica, którego album ze zdjęciami żyje na tym laptopie, tak samo jak dla instytucji publicznej, której biblioteka marki podlega zasadom zamówień publicznych. Dla organizacji - instytucji publicznych, branż regulowanych, każdego, czyja marka jest zasobem strategicznym, a nie dekoracją - pytanie "gdzie żyje nasza treść i kto może ją wyłączyć" jest kwestią zarządzania, nie preferencją. Suwerenność jest tu właściwością architektury, a nie funkcją hostingową dodaną dla zgodności, a strony [Polityka prywatności](/info/privacy.html) i [Zweryfikuj to sam](/info/verify-yourself.html) istnieją, żebyś mógł to sprawdzić, a nie musiał uwierzyć na słowo.

U podstaw tego wszystkiego jest jedna obietnica, sformułowana jako zobowiązanie, a nie funkcja: **jeśli renderuje się na twoim urządzeniu, jest wolne na zawsze.** Silnik, powłoki, narzędzia, formaty - cała ścieżka twórcza działająca na urządzeniu jest open source i taka pozostaje. Ta obietnica ma mechanizm: wydana wersja jest licencjonowana tak, że nie da się jej cofnąć, i nie istnieje żadna umowa z współtwórcami, która pozwoliłaby później zmienić licencję pracy. Cała granica mieści się w jednym zdaniu: wszystko, co renderuje się na twoim urządzeniu, jest wolne i open source na zawsze; koordynacja ludzi i maszyn w sieci to zadanie osobnej płaszczyzny sterowania, [lolly.work](https://lolly.work).
