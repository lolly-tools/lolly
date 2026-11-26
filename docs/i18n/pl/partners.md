# Współpraca z partnerami

Wiele prac łączy dwie marki, na przykład logo sponsora na plakacie wydarzenia, oferta sprzedawcy pod nazwą producenta, wspólny komunikat lub studium przypadku napisane z dostawcą. Ta strona jest dla obu stron.

Na tej stronie **marka wiodąca** to marka, w której systemie projektowym powstaje praca, a **partner** to druga marka w tej pracy. Każda ze stron może ją stworzyć. [Architektury marek](/info/brand-architectures.html#co-branding) porównują co-branding z innymi układami marek.

<!--i:eti-info-->
## Jak Lolly obsługuje dziś dwie marki

- **Każdą pracę rysuje jeden system projektowy.** Obowiązują kolory, typografia i reguły organizacji marki wiodącej. Znak partnera trafia jako grafika: obraz z Assets lub własny znak przechowywany w systemie projektowym.
- **Marka jest przenoszona jako plik.** Plik systemu projektowego (`.lolly`) zawiera tokeny, czcionki i logo. Narzędzie wielokrotnego użytku utworzone przez **Share with rules** zawiera jeden gotowy układ z dozwolonymi przez Ciebie danymi wejściowymi. Umiejętności marki są przenoszone w osobnych plikach.
- **Marka może też mieć adres.** [Strona marki](/info/brand-page.html) publikuje logo, kolory, typografię i reguły do przeczytania przez partnera, z tokenami i umiejętnościami dla jego narzędzi.
- **Lolly sprawdza tylko reguły marki wiodącej.** Lolly nie zna reguł partnera, takich jak pole ochronne lub minimalny rozmiar, więc sprawdź je w wytycznych partnera. W programie partnerskim Lolly Work zestaw partnerski firmy zawiera jej reguły, a Lolly Design sprawdza znaki firmy względem tego zestawu.
- **Cały program partnerski działa w Lolly Work.** Gdy sprzedawcy, dystrybutorzy lub inni partnerzy tworzą prace w Twojej marce w Twoim Lolly Work, program partnerski udostępnia każdej firmie partnerskiej tylko wybrane przez Ciebie narzędzia, pliki i szablony. Program przechowuje logo i dane firmy, wstawia je do Twoich szablonów i zapisuje firmę w każdym pliku. [Prowadzenie programu partnerskiego](/info/manage/run-a-partner-programme.html) to przewodnik dla zespołu, który go prowadzi.

<!--i:eti-folder-shared-->
## Udostępnij swoją markę partnerowi

### Wybierz, co wysłać

| Co wysłać | Jak | Co otrzymuje partner | Dla kogo lub do czego |
| --- | --- | --- | --- |
| Plik systemu projektowego | **Export** na pasku u góry [Lolly Design System Setup](/info/brand-studio.html#move-a-brand-between-devices) | Twoje tokeny, czcionki, logo i preferencję motywu jako system projektowy, na który może się przełączyć | Partner tworzący wiele prac w Twojej marce |
| Narzędzie wielokrotnego użytku | W Lolly Design, **Share with rules** ([Udostępnij projekt z regułami](/info/create-a-tool.html)) | Jeden gotowy układ z dozwolonymi przez Ciebie danymi wejściowymi, takimi jak nazwa i logo partnera. Plik zawiera rozpoznane kolory, czcionki i obrazy, więc własny system projektowy partnera nie może zmienić stylu stałej grafiki | Ulotka, odznaka lub baner z dwiema markami, które wypełnia każdy partner |
| Umiejętności marki | Sekcja **Skills**: **Download skill (.zip)** lub **Copy as one file** | Twoje spisane standardy dla ludzi i agentów partnera | Każda z powyższych opcji, gdy agent wykonuje część pracy |
| Strona marki | **Publish a brand page** w Lolly Design System Setup lub `lolly system publish` zapisuje folder, który udostępniasz na hostingu ([Strony marek](/info/brand-page.html)) | Twoje aktualne logo, kolory, typografia i reguły pod jednym adresem, z tokenami i umiejętnościami dla narzędzi partnera. Logo i pliki czcionek pojawiają się, gdy pozwalają na to ich prawa, a strona wymienia to, co pominięto | Udostępnianie osobom, którym nie wysyłasz plików |
| Tokeny | **Tokens (.json)** w menu **More** studia | Sam dokument tokenów projektowych, bez czcionek i logo | Własne narzędzia projektowe lub proces kompilacji partnera |

![Lolly Design System Setup w Lolly Demo, z otwartą sekcją Skills: Export na pasku, otwarte menu More z Tokens (.json) oraz Download skill (.zip) i Copy as one file obok wybranej umiejętności](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dskills&width=1200&height=900&dpi=192&waitMs=1800&waitSelector=.skills-reader-actions&drive=click%3A%5Bdata-ds-more%5D%3Bwait%3A500&format=svg&walker=1&dark=1&filename=partners-send)

::: warning Twoje czcionki są dołączane do pliku
Dodane czcionki są zawarte w pliku systemu projektowego, więc sprawdź, czy ich licencje pozwalają przekazywać te pliki dalej.
:::

Narzędzie wielokrotnego użytku prosi o potwierdzenie, zanim dołączy obraz, którego licencja ogranicza udostępnianie ([Podgląd i udostępnianie](/info/create-a-tool.html#preview-and-share)).

### Utwórz szablon z oznaczeniami obu marek

Narzędzie wielokrotnego użytku zachowuje elementy każdego partnera w Twoim układzie. Partner zmienia tylko to, na co pozwalasz.

1. W Lolly Design przygotuj pracę w swoim systemie projektowym. Narysuj boks obrazu na logo partnera i zostaw wokół niego tyle miejsca, ile wymaga układ.
2. Wybierz **Share with rules** z menu File. Zaznacz boks obrazu i wybierz **Make editable**. W jego **Rules** zezwól na przesyłanie zamienników, ustaw minimalny rozmiar w pikselach i akceptowane formaty przesyłanych plików (SVG, gdzie to możliwe). Ustaw **Image fit** boksu na **Contain (fit inside)**, aby szerokie lub wysokie logo mieściło się w boksie.
3. Pozwól też edytować nazwę lub ofertę partnera, z limitem znaków.
4. Naciśnij **Preview** i wypróbuj bardzo szerokie logo, bardzo wysokie logo i długą nazwę.
5. Wybierz **Share .lolly** i napisz instrukcje dla partnera: którą wersję logo ma przesłać, na przykład poziome logo w pełnym kolorze na jasne tło.

![Share with rules na karcie wydarzenia ze wspólnym brandingiem: boks logo partnera jest zaznaczony i edytowalny, a jego Rules pozwalają przesyłać obrazy o rozmiarze co najmniej 480 na 110 pikseli, w PNG lub SVG](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1280&height=1000&dpi=192&waitMs=3000&drive=click%3Abutton%5Baria-label%3D%22File%20menu%22%5D%3Bwait%3A500%3Bclick%3Atext%3DShare%20with%20rules%3Bwait%3A2500%3Bclick%3A%23tool-canvas%20%5Bdata-box-id%3D%22partner%22%5D%3Bclick%3Abutton%3Ahas-text%28%22Make%20editable%22%29%3Bwait%3A1200%3Bclick%3A.dr-input%20.dr-advanced%20%3E%20summary%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminWidth%22%5D%3Bpress%3A4%3Bpress%3A8%3Bpress%3A0%3Bpress%3AControlOrMeta%2BA%7Con%3D%5Bdata-rule%3D%22image%3AminHeight%22%5D%3Bpress%3A1%3Bpress%3A1%3Bpress%3A0%3Bclick%3A%5Bdata-rule%3D%22image-format%3Ajpeg%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Awebp%22%5D%3Bclick%3A%5Bdata-rule%3D%22image-format%3Aavif%22%5D&format=svg&walker=1&dark=1&filename=partners-template-rules)

Partner upuszcza plik w Lolly, zapoznaje się z pytaniem o zaufanie, wypełnia dane wejściowe i pobiera dozwolone formaty ([Korzystanie z gotowego narzędzia](/info/create-a-tool.html#use-the-finished-tool)). Lolly utrzymuje logo w narysowanym przez Ciebie boksie. Lolly nie odczytuje zasad partnera dotyczących pola ochronnego, więc logo ma tylko tyle miejsca, ile zostawisz wokół boksu.

### Przekaż agentowi umiejętności swojej marki

Umiejętności prowadzą ludzi i agentów. Lolly sprawdza zasady organizacji.

- W Lolly Design System Setup otwórz sekcję **Skills** (`#/start?area=skills`), wybierz umiejętność i naciśnij **Download skill (.zip)**. Linki do katalogu w folderze wskazują Twoje Lolly, a jego `lolly.json` zapisuje, skąd pochodzi kopia. **Copy as one file** umieszcza ten sam tekst w schowku do wklejenia w oknie czatu.
- W terminalu `lolly system skill <name> --into=<dir>` zapisuje ten sam folder ([W folderze dla lokalnego narzędzia agenta](/info/brand-skills.html#in-a-folder-for-a-local-agent-tool)).
- Twój komputer wyświetla umiejętności oznaczone jako `internal` oraz `public`, więc wybierz, które wysłać ([Umiejętności publiczne i wewnętrzne](/info/brand-skills.html#public-and-internal-skills)).
- Dla systemu projektowego bez własnych umiejętności Lolly tworzy wersję podstawową na podstawie tokenów i zasad organizacji, a sekcja ją wyświetla.
- Kopia nie aktualizuje się sama. Gdy opublikujesz nową wersję umiejętności, wyślij folder ponownie.

<!--i:eti-download-->
## Pracuj z otrzymaną marką

Dla partnera, który otrzymuje plik systemu projektowego. Gdy marka wiodąca prowadzi program partnerski we własnym Lolly Work, logujesz się tam: strona główna otwiera się na karcie Twojej firmy i opublikowanych dla Ciebie szablonach ([Co widzą partnerzy](/info/manage/run-a-partner-programme.html#what-partners-see)).

1. **Otwórz plik.** Upuść plik w Lolly lub naciśnij **Open**; **Add from…** w Lolly Design System Setup też przyjmuje ten plik. Podgląd pokazuje zawartość pliku, zanim cokolwiek zostanie zapisane. Plik systemu projektowego dodaje osobny system projektowy pod nazwą marki wiodącej i go aktywuje. Twój system projektowy pozostaje na urządzeniu. Plik, który zamiast tego łączy aplikację z własnym Lolly marki wiodącej, najpierw wymienia skutki dla całego urządzenia; [Korzystanie z Lolly w organizacji](/info/organisation.html) opisuje ten rodzaj pliku.
2. **Poznaj markę.** W Lolly Design System Setup **Board** pokazuje zawartość systemu projektowego, **Logos** zawiera jego znaki, a **Rules** wymienia zasady organizacji sprawdzane przez Lolly. **Skills** pokazuje wersję podstawową, którą Lolly tworzy z tokenów i zasad; własne umiejętności marki wiodącej przychodzą jako osobne pliki, jeśli marka je wyśle.
3. **Przełączaj się między markami.** **Settings → Preferences → Design systems** przełącza system projektowy dla całego urządzenia, a **Settings → Design system** ma pasek okładek do przełączania. Zakończ pracę dla jednej marki, zanim się przełączysz.
4. **Umieść własny znak.** Prześlij logo do **Assets**, gdzie jest dostępne w każdym systemie projektowym, lub dodaj je jako **własny znak** w systemie projektowym marki wiodącej (sekcja **Logos**, **Custom marks**), gdzie jest dołączane do pliku tego systemu projektowego. System projektowy z kłódką jest tylko do odczytu, więc korzystaj wtedy z Assets. [Umieść znak partnera](#place-a-partner-s-mark) opisuje, co sprawdzić.
5. **Sprawdź przed eksportem.** W Lolly Design karta **Before you export** w panelu eksportu wymienia wyniki sprawdzenia zasad marki wiodącej, warstwa po warstwie ([Przed eksportem](/info/design.html#before-you-export)). Karta **Design system** pokazuje system projektowy zapisany w pliku.
6. **Odeślij pracę.** Wyślij wyeksportowany plik lub edytowalny projekt jako `.lolly` ([Udostępnianie pracy](/info/using.html#sharing-your-work)). Projekt otwiera się w aktywnym systemie projektowym, więc marka wiodąca otwiera Twój projekt ze swoim systemem projektowym jako aktywnym.

::: note Plik systemu projektowego nie aktualizuje się
Plik systemu projektowego jest kopią marki z dnia eksportu. Nic nie aktualizuje tej kopii.
:::

Gdy marka wiodąca wyśle nowszy plik, otwórz go w ten sam sposób. Następnie sprawdź, który system projektowy jest aktywny w **Settings → Preferences → Design systems**, i usuń tam starszą kopię, gdy nie będzie już potrzebna.

![Design systems w Settings: Lolly Demo jest aktywny, Lolly Starter ma przycisk Use przełączający całe urządzenie, a Open or import a file przyjmuje plik systemu projektowego](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddesign-systems-section&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23design-systems-section&format=svg&walker=1&dark=1&filename=partners-design-systems)

<!--i:eti-image-->
## Umieść znak partnera

| Sposób | Kroki | Najlepszy do |
| --- | --- | --- |
| Obraz w Assets | Upuść plik w obszarze przesyłania w **Assets**, a następnie wybierz go w polu obrazu narzędzia lub w Lolly Design przez **Image** z menu dodawania na szynie | Jednorazowych prac. Przesłany plik należy do urządzenia, więc jest dostępny niezależnie od aktywnego systemu projektowego |
| Własny znak | Sekcja **Logos**, **Custom marks**: wpisz nazwę znaku, a następnie **Choose file…** | Partnera, z którym często współpracujesz. Znak należy do systemu projektowego i jest dołączany do jego pliku |
| Gotowy układ znaków | Ułóż oba znaki w narzędziu do rysowania, a następnie dodaj układ jako własny znak | Wielokrotnie używanego układu znaków z dopiskiem „z” lub „we współpracy z” |

::: check Przed eksportem sprawdź znak
- **Właściwy plik.** Użyj pliku dostarczonego przez partnera, najlepiej SVG, jeśli jest dostępny. Logo skopiowane ze strony internetowej lub slajdu rozmywa się w druku.
- **Właściwa wersja do tła.** Na ciemnym lub złożonym tle użyj wersji w kontrze lub jednokolorowej, jeśli wytyczne partnera ją przewidują.
- **Proporcje.** Ustaw **Image fit** boksu obrazu na **Contain (fit inside)**, a znak nigdy nie zostanie rozciągnięty.
- **Pole ochronne i rozmiar.** Zostaw wokół znaku przestrzeń wymaganą przez wytyczne partnera i utrzymuj znak powyżej minimalnego rozmiaru. Lolly nie mierzy żadnej z tych wartości.
- **Która marka jest wiodąca.** Dobierz rozmiary obu znaków zgodnie z wytycznymi obu marek dotyczącymi tego, która z nich jest wiodąca.
- **Prawa.** Lolly pokazuje licencję zapisaną dla zasobu katalogowego. Plik przesłany samodzielnie nie ma zapisanej licencji, a jego szczegóły wyświetlają *Licence not recorded*, więc zachowaj zgodę partnera na użycie jego znaku we własnej dokumentacji ([Prawa twórców i informacje o autorstwie](/info/creative-rights.html)).
:::

![Before you export na karcie ze wspólnym brandingiem: system projektowy to Lolly Demo, logo partnera jest oznaczone jako obraz spoza zasobów systemu projektowego, a cztery zasady organizacji nie zgłaszają uwag](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fboxes%3D%255B%257B%2522id%2522%253A%2522board%2522%252C%2522name%2522%253A%2522Build%2520day%2520card%2522%252C%2522kind%2522%253A%2522frame%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A0%252C%2522w%2522%253A1600%252C%2522h%2522%253A900%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.sugar%257D%2522%252C%2522clipChildren%2522%253Atrue%257D%252C%257B%2522id%2522%253A%2522dot-large%2522%252C%2522name%2522%253A%2522Large%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1040%252C%2522y%2522%253A70%252C%2522w%2522%253A480%252C%2522h%2522%253A480%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.pandanus%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522dot-small%2522%252C%2522name%2522%253A%2522Small%2520circle%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A1330%252C%2522y%2522%253A380%252C%2522w%2522%253A240%252C%2522h%2522%253A240%252C%2522shape%2522%253A%2522circle%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.green-apple%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522band%2522%252C%2522name%2522%253A%2522Partner%2520band%2522%252C%2522kind%2522%253A%2522box%2522%252C%2522x%2522%253A0%252C%2522y%2522%253A680%252C%2522w%2522%253A1600%252C%2522h%2522%253A220%252C%2522shape%2522%253A%2522rect%2522%252C%2522bg%2522%253A%2522%257Bcolor.brand.avocado%257D%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522lolly%2522%252C%2522name%2522%253A%2522Lolly%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A96%252C%2522w%2522%253A260%252C%2522h%2522%253A90%252C%2522image%2522%253A%2522lolly%2Flogo%2Fhorizontal%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522imgpos%2522%253A%2522left%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522headline%2522%252C%2522name%2522%253A%2522Headline%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A260%252C%2522w%2522%253A880%252C%2522h%2522%253A180%252C%2522text%2522%253A%2522Build%2520day%25202026%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.liquorice%257D%2522%252C%2522fontSize%2522%253A120%252C%2522weight%2522%253A%2522700%2522%252C%2522font%2522%253A%2522display%2522%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522sub%2522%252C%2522name%2522%253A%2522Subtitle%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A450%252C%2522w%2522%253A880%252C%2522h%2522%253A90%252C%2522text%2522%253A%2522Twelve%2520hours%2520of%2520making%252C%2520with%2520friends%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A48%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522with%2522%252C%2522name%2522%253A%2522In%2520partnership%2520with%2522%252C%2522kind%2522%253A%2522text%2522%252C%2522x%2522%253A120%252C%2522y%2522%253A750%252C%2522w%2522%253A400%252C%2522h%2522%253A80%252C%2522text%2522%253A%2522In%2520partnership%2520with%2522%252C%2522fg%2522%253A%2522%257Bcolor.brand.basalt%257D%2522%252C%2522fontSize%2522%253A34%252C%2522align%2522%253A%2522left%2522%252C%2522valign%2522%253A%2522middle%2522%252C%2522frame%2522%253A%2522board%2522%257D%252C%257B%2522id%2522%253A%2522partner%2522%252C%2522name%2522%253A%2522Partner%2520logo%2522%252C%2522kind%2522%253A%2522image%2522%252C%2522x%2522%253A500%252C%2522y%2522%253A735%252C%2522w%2522%253A480%252C%2522h%2522%253A110%252C%2522image%2522%253A%2522%2Ftools%2Flogo-wall%2Fassets%2Fpartner-name.svg%2522%252C%2522fit%2522%253A%2522contain%2522%252C%2522frame%2522%253A%2522board%2522%257D%255D%26w%3D1600%26h%3D900&width=1440&height=1000&dpi=192&waitMs=3000&drive=click%3A.edge-dock-tab%3Ahas-text%28%22Export%22%29%3Bwait%3A2500%3Bclick%3A%5Bdata-action%3D%22preflight-open%22%5D%3Bwait%3A1200&cropSelector=.preflight-modal&format=svg&walker=1&dark=1&filename=partners-before-export)

[Zapis systemu projektowego](/info/exporting.html#the-design-system-record) w eksporcie podaje system projektowy i wariant kolorystyczny marki wiodącej. Nie zapisuje marki partnera, z wyjątkiem programu partnerskiego Lolly Work, gdzie podaje też firmę partnera i program, dla którego powstała praca.

### Przekaż agentowi umiejętności każdej marki

Gdy pracę wykonuje agent, przekaż mu umiejętności obu marek bez zmian i powiedz, która marka jest wiodąca. Umiejętności każdej marki zachowują własne nazwy i identyfikatory. Lolly nie łączy umiejętności dwóch marek ani nie decyduje, która marka ma pierwszeństwo.

<!--i:eti-grid-->
## Ścianki z logo dla sponsorów i wydarzeń

Narzędzie [Lolly Logo Wall](/#/tool/logo-wall) układa logo w równą siatkę na tablicę sponsorów, slajd partnerów lub ściankę prasową. Na wydarzeniu marką wiodącą jest zwykle organizator: ścianka powstaje w jego systemie projektowym, a logo każdego sponsora jest na niej grafiką.

![Ścianka sponsorów w trzech poziomach na ciemnozielonym tle, każde logo w bieli: dwóch złotych partnerów, trzech srebrnych i pięciu partnerów społecznościowych, każdy poziom pod własnym nagłówkiem i każdy niższy poziom o stopień mniejszy](/t/url-shot?url=%2F%23%2Ftool%2Flogo-wall%3Flogos%3D%255B%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fyour-logo.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Flogo-here.svg%2522%252C%2522tier%2522%253A%2522Gold%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fcompany.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsponsor.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fbrand-name.svg%2522%252C%2522tier%2522%253A%2522Silver%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fsample-co.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fexample.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Florem-ipsum.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fplaceholder.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%252C%257B%2522logo%2522%253A%2522%252Ftools%252Flogo-wall%252Fassets%252Fpartner-name.svg%2522%252C%2522tier%2522%253A%2522Community%2520partners%2522%257D%255D%26columns%3D3%26gap%3D64%26padding%3D96%26background%3D033633%26headingColor%3Dffffff%26vectorizeAll%3Dtrue%26inkColor%3Dffffff%26transparentBg%3Dfalse&width=1440&height=900&dpi=192&waitMs=4000&cropSelector=%23tool-canvas&format=svg&walker=1&filename=partners-logo-wall&try=1)

1. Otwórz Lolly Logo Wall i upuść logo na **Logos**. Każde logo otrzymuje własny zestaw kontrolek.
2. Przypisz każdemu logo **Tier**, na przykład „Złoci partnerzy”. Każdy poziom ma własne wiersze pod własnym nagłówkiem, w kolejności pierwszego wystąpienia poziomów; **Tier headings** wyłącza nagłówki. Przy **Tier sizes** ustawionym na **Step down** każdy niższy poziom mieści o jedno logo więcej w wierszu, więc wyższe poziomy wyglądają na większe. **Presence** i **Size %** dostosowują pojedyncze logo w jego poziomie.
3. Zostaw włączone **Balance sizes**. Lolly Logo Wall dobiera rozmiar każdego logo według jego wagi optycznej, więc ciężkie logo maleje, a lekkie rośnie i każdy poziom wygląda równomiernie.
4. **Trim margins** przycina każde logo do granic grafiki. Wyłącz tę opcję, gdy plik logo zawiera już pole ochronne wymagane przez właściciela.
5. **Remove white backgrounds** usuwa biały prostokąt, który często otacza logo skopiowane ze slajdu.
6. Ustaw **Columns**, odstępy i marginesy wewnętrzne w **Layout**. Początkowa wartość **Background** to kolor powierzchni z Twojego systemu projektowego.
7. Aby uzyskać jednokolorową ściankę, włącz **Render all as vector** i wybierz **Ink colour** lub ustaw **Filter** pojedynczego logo na **Greyscale**. Używaj wersji jednokolorowej tylko wtedy, gdy pozwalają na to wytyczne każdego sponsora.
8. Dla ścianki prasowej wybierz **Grid**, **Brick** lub **Checker** w **Step & repeat** i ustaw liczbę **Rows**.

Wyeksportuj ściankę jako PNG, SVG, PDF lub PDF w CMYK do druku. Ustaw inny rozmiar i kształt w panelu eksportu, na przykład pionową relację 1080 x 1920 lub stronę A4, a kanwa ponownie ułoży ściankę, aby wypełnić ten kształt, z mniejszą lub większą liczbą logo w każdym wierszu. Eksport odpowiada kanwie. Aby umieścić ściankę na plakacie, wybierz **Image** z menu dodawania na szynie w Lolly Design, narysuj ramkę i wybierz Lolly Logo Wall na karcie **Tools** selektora ([Narzędzia wewnątrz projektu](/info/design.html#tools-inside-a-design)). Aby umieścić podpisy między logo, **Dynamic layout** ustawiony na **grid** w Lolly Design zawiera po jednym boksie obrazu na logo ([Układ w Lolly Design](/info/design-layout.html#dynamic-layouts)).

W terminalu `lolly run logo-wall logos/*.png --output=wall.svg` tworzy ściankę z folderu obrazów, a CSV z kolumnami `logo` i `tier` tworzy ściankę z poziomami. SVG i PNG nie wymagają przeglądarki ([Ścianka sponsorów z poziomami](/info/cli-rendering.html#a-sponsor-wall-with-tiers)).

Gdy sponsor publikuje [stronę marki](/info/brand-page.html), `lolly run logo-wall --logos-from=<address or folder>` pobiera jego aktualne logo dla danej powierzchni i wypisuje informacje o użyciu z jego strony. Powtórz flagę dla każdego sponsora.

Lolly Logo Wall nie zna zasad żadnego sponsora. Tiers i Presence ustawiają rozmiary względem siebie, a nie minimalny rozmiar sponsora, i nic nie sprawdza pola ochronnego między sąsiadami. Sprawdź gotową ściankę pod kątem wytycznych każdego sponsora w rozmiarze, w jakim będzie drukowana lub wyświetlana.

<!--i:eti-hammer-->
## Czego Lolly jeszcze nie robi

- Praca powstaje w jednym systemie projektowym. Kolory, typografia i zasady partnera nie są systemem projektowym wewnątrz pracy, a znak partnera jest obrazem.
- Poza programem partnerskim Lolly Work zasady partnera nie są przechowywane ani sprawdzane w aplikacji: pole ochronne, minimalny rozmiar i dozwolone warianty, takie jak jeden kolor lub kontra.
- Pakiet partnera, lekki zestaw zawierający jego logo, kolory i zasady do użycia w pracy innej marki, trafia do aplikacji tylko przez program partnerski Lolly Work. W innych przypadkach sprawdzenie pakietu uruchamia się w terminalu: `lolly check --kit=<file>` mierzy znaki partnera w dokumencie Lolly Design ([Sprawdź odtworzony projekt](/info/cli-decks.html#check-the-recreation)).
- Lolly nie tworzy układu dwóch znaków z dopiskiem „z”, „we współpracy z” ani „autorstwa”. Dodaj gotowy układ jako własny znak.
- Jeden system projektowy jest aktywny dla całego urządzenia, więc dwie marki nie mogą być otwarte obok siebie.
- Plik systemu projektowego wyeksportowany z aplikacji nie zawiera umiejętności marki, więc wyślij je jako osobne pliki.
- Logo pobrane ze strony marki jest obrazem w swoim wierszu, a wiersz nie pamięta strony. Nic nie pokazuje, kto opublikował stronę, więc sam sprawdź adres.
- Hostowana aplikacja internetowa nie może pobrać strony innej marki, ponieważ jej Content Security Policy dopuszcza tylko wskazane hosty. Pobierz logo w terminalu lub zapisz plik i dodaj go w **Assets**.

<!--i:eti-map-pin-->
## Co dalej

- **[Architektury marek](/info/brand-architectures.html)**: wspólny branding, white label i inne modele oraz sposób pracy z każdym z nich w Lolly.
- **[Prowadzenie programu partnerskiego](/info/manage/run-a-partner-programme.html)**: co partnerzy otrzymują w Twoim Lolly Work oraz jak skonfigurować i prowadzić program.
- **[Udostępnianie projektu z zasadami](/info/create-a-tool.html)**: narzędzia wielokrotnego użytku ze stałym układem i wybranymi przez Ciebie danymi wejściowymi.
- **[Umiejętności marki](/info/brand-skills.html)**: jak pisać i czytać umiejętności oraz przekazywać je agentowi.
- **[Lolly Design System Setup](/info/brand-studio.html)**: logo, własne znaki i przenoszenie systemu projektowego między urządzeniami.
- **[Strony marek](/info/brand-page.html)**: opublikuj swoją markę pod jednym adresem i pobierz logo partnera z jego strony.
- **[Prawa twórców i informacje o autorstwie](/info/creative-rights.html)**: co Lolly zapisuje o rysowanych dziełach.
