# Szybki start

Lolly zamienia twoje zasady - kolory, typografię, układy, logikę - w narzędzia, którymi każdy może tworzyć gotowe pliki: obrazy, PDF-y, karty do mediów społecznościowych, wideo, wypełniając kilka pól. Niewiele trzeba się uczyć i niczego nie trzeba wysyłać: tworzenie i eksport działają na twoim urządzeniu, online lub offline.

To jest ta jedna strona, którą warto przeczytać najpierw. Dwie rzeczy dają ci sprawność w pracy: **dostosuj Lolly do siebie** i **wnieś to, co już masz** (twoje pliki projektowe i tokeny). Wszystko inne jest oddalone o jeden link.

> Dopiero zaczynasz z Lolly i chcesz po prostu coś zrobić? [Zrób coś w 60 sekund](/info/make-something.html) przeprowadzi cię przez trzy przykłady, albo [otwórz aplikację](/#/), wybierz dowolne narzędzie z galerii, wypełnij pola i kliknij **Export**. Wróć tutaj, gdy zechcesz, by nosiło *twoją* markę.

![Widok Utilities - lokalne konie robocze, takie jak Strip Hidden Data, Compress PDF i Convert Image, wszystkie w jednym miejscu](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## 1. Dostosuj Lolly do siebie - skonfiguruj swój system projektowy

Twoja marka w Lolly to niewielki dokument **design tokens** - kolory, fonty i kilka zasad - względem którego renderuje każde narzędzie. Ustaw go raz, a wszystko, co tworzysz, jest zgodne z marką z założenia, a nie po kontroli. Są trzy drogi wejścia; wybierz tę, która pasuje do miejsca, gdzie twoja marka już mieszka.

### Zacznij od zera (kreator systemu projektowego)

Pierwsze uruchomienie zostawia cię w **galerii**, z krótkim oknem powitalnym, które proponuje trzy drogi wejścia - **Make it yours** (Brand Studio pod `#/start`), **Bring your design** (upuść plik Figma, Penpot, InDesign lub PDF, a otworzy się jako edytowalny układ - najszybsza droga do sekcji [Wnieś to, co już masz](#2-bring-in-what-you-already-have) poniżej) oraz **Explore the community tools** - plus rząd języków, jeśli angielski nie jest twoim. Wybierz pierwszą kartę, a trafisz do [**Brand Studio**](/info/brand-studio.html). Podaj nazwę i kolor podstawowy, a Lolly *wyprowadzi* z niego kompletną, dostępną paletę - jasne i ciemne tła, tekst, akcenty - tą samą matematyką koloru, której silnik używa wszędzie indziej.

![Pokój Colours w Brand Studio - kolor podstawowy i dostępna paleta, którą Lolly z niego wyprowadza](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours) Wybierz font i w niecałą minutę masz działającą markę. Dalej sześć pokoi studia - Overview, Colours, Type, Logos, Tokens, Files - pozwala rozwinąć ją tak daleko, jak chcesz, w dowolnej kolejności, dopracowując dowolny element przy każdym powrocie. Zakładka **Design system** na pulpicie (`#/d`) pokazuje wynik tylko do odczytu i odsyła z powrotem do `#/start`, gdzie odbywa się edycja (chyba że pracujesz na wersji Lolly z zablokowaną marką, gdzie marka jest stała i nie ma czego zmieniać).

### Zaimportuj markę, którą już masz

Jeśli twoja marka jest już zapisana jako design tokens - z **Penpot**, **Tokens Studio** (Figma) albo dowolnego zwykłego pliku **DTCG** - wnieś ją w całości, zamiast przepisywać ręcznie. Dwie drogi:

- <!--i:palette--> **W aplikacji:** [kreator systemu projektowego: Brand Studio](/info/brand-studio.html) (`#/start`) przyjmuje ją przez **Add from…** na dole listy pokoi - plik tokenów, eksport z Penpot, SVG albo paczkę `LollyBrand`. Upuść ją, a paleta się rozświetli.
- <!--i:code--> **Z wiersza poleceń**, aby postawić paczkę marki do wielokrotnego użytku:

```bash
# a monolithic tokens.json, a one-file-per-set directory, or a Penpot project archive
npm run ingest:brand -- ./my-tokens.json --name acme --label "Acme" --activate
```

`ingest:brand` przyjmuje wszystkie trzy kontenery, w których Penpot / Tokens Studio eksportują ten sam dokument - pojedynczy `tokens.json`, katalog (`$metadata.json` + pliki poszczególnych zestawów) albo archiwum `project.penpot`. Z `--activate` rejestruje markę jako profil, przełącza się na nią i przebudowuje katalog. Zobacz [Konfiguracja](/info/configuration.html), aby poznać, jak paczki marek i profile łączą się ze sobą.

### Dostrój ją w aplikacji

Gdy marka jest aktywna, kształtuj ją dalej w [**Brand Studio**](/info/brand-studio.html) (`#/start`) - zmień kolor albo rolę, a każdy podgląd w aplikacji zaktualizuje się w trakcie pisania. (Zakładka **Design system** na pulpicie pod `#/d` *pokazuje* markę tylko do odczytu; edytujesz ją w Studiu.)

![Zakładka Design system na pulpicie - aktywna marka pokazana tylko do odczytu](/t/url-shot?url=%2F%23%2Fd%3Ftab%3Dbrand&width=1440&height=900&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=dashboard-brand) Ta sama marka jest podsumowana na karcie **Profile → Your brand**. Fonty są prawdziwe: wybierz z Google Fonts, a Lolly zapisze plik **na twoim urządzeniu** jako zasób marki, więc twoja typografia jedzie z tobą offline i nic nie jest pobierane w czasie renderowania.

Gdy będziesz zadowolony, **wyeksportuj markę jako paczkę `LollyBrand`** - jeden plik, który współpracownik może zaimportować, by dostać dokładnie tę samą paletę, fonty i zasady. Tak marka przemieszcza się między ludźmi i maszynami bez serwera pośrodku.

> **Tokeny marki krążą w obie strony.** Ponieważ marka w Lolly *jest* tokenami DTCG - formatem, który Penpot natywnie czyta i zapisuje, a Tokens Studio wnosi do Figmy - paleta, którą *projektujesz*, i paleta, którą Lolly *egzekwuje*, to jeden dokument, a nie dwie listy ręcznie utrzymywane w zgodzie. Zobacz [Design Tokens](/info/design-tokens.html).

## 2. Wnieś to, co już masz

Nie zaczynasz od pustej strony. Lolly otwiera projekty i otwarte formaty, które już masz.

### Otwarte pliki projektowe

Gotowa praca w **Figmie, Penpot, Illustratorze, InDesignie lub dowolnej aplikacji SVG** nie musi zostać zamknięta w programie, w którym ją narysowano. Otwórz **Design**, kliknij **Import a design**, a plik otworzy się jako *żywy układ* - nie spłaszczony obrazek. Każda warstwa staje się edytowalnym polem: tekst da się przepisać, kształty pozostają kształtami, obrazy trafiają do twojej biblioteki, a złożona grafika wektorowa jest wiernie zachowana. Przychodzi już dopasowana do krojów i zasad kolorystycznych twojej marki.

| Masz | Wnieś to jako |
|---|---|
| Ramkę z Figmy | Natywny `.fig` (File → Save local copy) albo eksport do SVG |
| Projekt z Penpot | Jego eksport `.penpot` albo dowolny SVG |
| Plik z Illustratora | Natywny `.ai` (zgodny z PDF) albo `.pdf` - otwiera się bezpośrednio |
| Układ z InDesigna | `.idml` (File → Export → InDesign Markup) |
| Cokolwiek innego | **Dowolny SVG** - uniwersalne wejście |

Cały import odbywa się **na twoim urządzeniu** - plik jest parsowany w twojej przeglądarce i nic nie jest wysyłane. Pełne szczegóły i dokładny zakres tego, co się przenosi, znajdziesz w [Import projektu](/info/design-import.html).

Masz zamiast tego **prezentację PowerPoint**? Upuść `.pptx` na **Deck Builder**, aby edytować ją slajd po slajdzie, od razu dopasowaną do twojej marki - albo uruchom **Rebrand a Deck**, aby dostać tę samą prezentację w nowej szacie, z nienaruszonymi wykresami i animacjami.

### Od jednorazowego projektu do szablonu

Oto zysk: zaimportowany układ jest zwykłą sesją Design, więc gdy go **zapiszesz**, mieszka pod adresem URL. Każdy, kto ma Lolly, może otworzyć ten URL, zmienić słowa, podmienić obraz i wyrenderować własną wersję - bez aplikacji projektowej, a zablokowane części zostają zablokowane. Jednorazowy projekt staje się narzędziem wielokrotnego użytku. O to właśnie chodzi, a dochodzisz do tego bez pisania choćby linijki konfiguracji.

### Otwarte dane i otwarte narzędzia

[Zestaw narzędzi społeczności](/info/builders.html) jest otwartoźródłowy i niezależny od marki - kody QR, mapy ulic, filtry, narzędzia prywatności - i renderuje względem *twojej* marki w chwili, gdy ją aktywujesz.

Zasil narzędzia także własnymi otwartymi danymi: wklej lub upuść tabelę **CSV** albo **JSON**, a powtarzalne pola narzędzia wypełnią się z niej, jeden gotowy plik na wiersz.

## 3. Zrób coś, a potem udostępnij to lub zautomatyzuj

Z aktywną marką i twoim materiałem pod ręką każde narzędzie tworzy gotowy plik:

- <!--i:download--> **Renderuj** dowolne narzędzie do **SVG, PDF, PNG, JPG, WebP, wideo** i innych formatów - w prawdziwych rozmiarach druku i jednostkach fizycznych, kiedy ich potrzebujesz. Zobacz [Eksport i formaty](/info/exporting.html).
- <!--i:link--> **Udostępnij link.** Każdy stan narzędzia to URL, więc gotowy plik jest odtwarzalny i adresowalny parametrami - zapisz link w repozytorium, generuj ponownie na żądanie.
- <!--i:layers--> **Rób to masowo.** Steruj szablonem z arkusza kalkulacyjnego w [siatce wsadowej](/info/exporting.html): jeden gotowy plik na wiersz.
- <!--i:cpu--> **Zautomatyzuj to.** Ten sam render działa z [CLI](/info/cli.html) i z [agenta AI](/info/ai-agents.html) - URL jest API.

„URL jest API” to stwierdzenie dosłowne. Poniższego wykresu nikt nie narysował: jego typ, nagłówek i cała tabela danych zostały wpisane w pasek adresu, a ten sam link renderuje ten sam wykres na dowolnym urządzeniu.

![Wykres warstwowy comiesięcznych rejestracji, gdzie każda wartość dotarła jako parametr zapytania, a nie jako kliknięcie](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Darea%26d%3DMonth%2CSignups%250AJan%2C120%250AFeb%2C180%250AMar%2C265%250AApr%2C340%250AMay%2C455%26t%3DSignups%2520this%2520year%26full&width=1440&height=900&dpi=192&waitMs=2600&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-d3-url-chart)

## Dokąd dalej

Trzy ścieżki, zależnie od tego, po co tu jesteś:

- <!--i:people--> **[Lolly dla twórców](/info/creators.html)** - robisz rzeczy. Korzyści i jak wycisnąć z aplikacji najwięcej.
- <!--i:code--> **[Lolly dla deweloperów](/info/builders.html)** - piszesz narzędzia, integrujesz i wdrażasz. Dokumentacja techniczna.
- <!--i:shieldcheck--> **[Lolly dla operatorów](/info/operators.html)** - odpowiadasz za markę, bezpieczeństwo i wdrożenie w całej organizacji.
