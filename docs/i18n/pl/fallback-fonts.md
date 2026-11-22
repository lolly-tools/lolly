# Czcionki zastępcze

Gdy czcionki systemu projektowego nie potrafią narysować litery, Lolly rysuje ją otwartą czcionką Noto, więc eksport zachowuje literę jako kontur wektorowy zamiast obrazu. Czcionki Lolly Demo, Outfit dla nagłówków i SUSE dla tekstu, nie mają liter cyrylicy, greckich, arabskich, hebrajskich, dewanagari, bengalskich, tajskich, chińskich, japońskich ani koreańskich.

Czcionki systemu projektowego zawsze mają pierwszeństwo, w kolejności na liście. Outfit nie ma liter wietnamskich, więc wietnamski nagłówek bierze je z SUSE, następnej czcionki na liście Lolly Demo. Czcionka zastępcza rysuje tylko znaki, których nie potrafi narysować żadna z tych czcionek. Czcionka marki zachowuje każdą literę, cyfrę i znak, które ma, w tym znaki chińskie, nawet wewnątrz słowa zapisanego innym pismem.

<!--i:eti-package-->
## Co jest dołączone

Piętnaście czcionek, wszystkie z Google Fonts z ustalonego commita. Przy każdym pliku podany jest rozmiar pobierania.

| Pismo | Czcionka | Wersja | Pobieranie |
|---|---|---|---|
| Arabskie, w tym litery urdu i perskie | Noto Sans Arabic | 2.012 | 211 KB |
| Hebrajskie | Noto Sans Hebrew | 3.001 | 37 KB |
| Dewanagari (hindi, marathi, nepalski) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengalskie | Noto Sans Bengali | 3.011 | 139 KB |
| Tajskie | Noto Sans Thai | 2.002 | 62 KB |
| Cyrylica | Noto Sans, litery cyrylicy | 2.015 | 115 KB, kursywa 132 KB |
| Greckie | Noto Sans, litery greckie | 2.015 | 77 KB, kursywa 83 KB |
| Łacińskie, w tym wietnamskie i inne litery ze znakami diakrytycznymi | Noto Sans, litery łacińskie | 2.015 | 316 KB, kursywa 350 KB |
| Chińskie uproszczone, znaki GB 2312 | Noto Sans SC | 2.004 | 2.0 MB |
| Chińskie tradycyjne, znaki Big5 | Noto Sans TC | 2.004 | 3.8 MB |
| Japońskie, znaki Shift_JIS | Noto Sans JP | 2.004 | 2.2 MB |
| Koreańskie, każda sylaba hangul i znaki KS X 1001 | Noto Sans KR | 2.004 | 2.5 MB |

Każda czcionka zachowuje wszystkie grubości na swojej osi grubości, więc pogrubiony nagłówek chiński, japoński lub koreański jest pogrubiony. Czcionki Noto Sans mają oś szerokości ustawioną na stałe na normalną, co zmniejsza każdy plik o połowę. Czcionki chińskie, japońskie i koreańskie nie mają osi szerokości. Noto Sans jest podzielona według pisma, więc słowo w cyrylicy powoduje pobranie tylko liter cyrylicy. Kontury pozostają niezmienione względem źródła.

::: details Gdzie znajdują się czcionki i jak są budowane
Czcionki znajdują się w jednym wspólnym folderze, `community/fallback-fonts`, udostępnianym każdemu systemowi projektowemu z `/catalog/packs/fallback-fonts/`, tak jak zestawy emoji. `scripts/import-fallback-fonts.ts` buduje pliki z czcionek źródłowych przypiętych w `scripts/data/fallback-fonts.json`, sprawdza każdy plik źródłowy względem zapisanego SHA-256 i zapisuje teksty licencji obok czcionek.
:::

<!--i:eti-globe-->
## Chiński, japoński i koreański

Pełna czcionka chińska, japońska lub koreańska ma od 9,6 MB do 17,8 MB. Każda jest przycięta do krajowego zestawu znaków oraz interpunkcji, kany, form o pełnej szerokości i symboli używanych w tekście ciągłym:

- Chiński uproszczony: GB 2312, 6763 popularne znaki hanzi i symbole tego zestawu, łącznie 7522 znaki.
- Chiński tradycyjny: Big5, 13 053 znaki hanzi i symbole tego zestawu, łącznie 13 629 znaków. Hong Kong Supplementary Character Set nie jest dołączony.
- Japoński: Shift_JIS w postaci odczytywanej przez Windows i przeglądarki, czyli JIS X 0208 z rozszerzeniami NEC i IBM potrzebnymi w nazwach zawierających na przykład 髙 i 﨑, wszystkie znaki kany i katakana o połowie szerokości, łącznie 7432 znaki.
- Koreański: wszystkie 11 172 sylaby hangul i KS X 1001 z 4888 znakami hanja, łącznie 17 082 znaki.

Te cztery czcionki pomijają litery łacińskie, greckie i cyrylicę, które rysują czcionki systemu projektowego i czcionki wymienione powyżej. Zestawy pochodzą z plików indeksowych Encoding Standard z ustalonego commita, więc ponowne zbudowanie daje te same pliki.

Chiński, japoński i koreański współdzielą większość znaków, ale wiele z nich rysują inaczej. Na przykład 直 zapisuje się inaczej po chińsku niż po japońsku. Jeden fragment tekstu bierze wszystkie współdzielone znaki z jednej z tych czcionek, nigdy z dwóch. Lolly wybiera tę czcionkę w następującej kolejności:

1. Język fragmentu, z `lang` jego elementu lub najbliższego elementu nadrzędnego w dokumencie. Ustawia go wybór języka w narzędziu, na przykład Language w certyfikacie. Język interfejsu Lolly i język systemu projektowego nie są brane pod uwagę, więc dokument eksportuje się tak samo dla każdego.
2. Pismo fragmentu: kana oznacza japoński, a hangul koreański. Gdy fragment nie zawiera żadnego z nich, Lolly odczytuje dokument, więc nagłówek z samym kanji w japońskim dokumencie jest rysowany po japońsku. Dokument zawierający zarówno kanę, jak i hangul nie rozstrzyga niczego na tym etapie.
3. Znak używany tylko w chińskim tradycyjnym, na przykład 體 lub 說, we fragmencie albo w pozostałej części dokumentu, oznacza chiński tradycyjny, chyba że ten sam tekst zawiera też znak używany tylko w chińskim uproszczonym.
4. W przeciwnym razie chiński uproszczony.

Znak, którego wybrana czcionka nie ma, nigdy nie jest pobierany z jednej z pozostałych trzech. Pozostaje obrazem. Kana lub hangul, których wybrana czcionka nie ma, na przykład koreańskie słowa w wierszu oznaczonym jako japoński, nadal mogą pochodzić z czcionki japońskiej lub koreańskiej, ale tylko wtedy, gdy ta czcionka nie rysowałaby żadnego współdzielonego znaku wiersza.

Na stronie kanwa zawierająca dwa z tych języków wymienia obie czcionki, a przeglądarka rysuje współdzielone znaki pierwszą z nich. Eksport rysuje każdy fragment jego własną czcionką.

<!--i:eti-download-->
## Kiedy pobiera się czcionka

Nic się nie pobiera, dopóki dokument nie zawiera znaku, którego nie potrafi narysować żadna czcionka jego systemu projektowego. Symbol w angielskim wierszu, na przykład ★ lub ※, nigdy nie powoduje pobrania czcionki chińskiej, japońskiej ani koreańskiej.

Gdy dokument po raz pierwszy potrzebuje czcionki zastępczej, Lolly pobiera tę jedną czcionkę i zachowuje ją na Twoim urządzeniu. Dokument japoński pobiera tylko czcionkę japońską, 2,2 MB, a dokument w chińskim tradycyjnym czcionkę tradycyjną o rozmiarze 3,8 MB. Od tej pory pismo jest rysowane offline, a czcionka pozostaje podczas porządkowania katalogu. Czcionka jest przechowywana z plikami katalogu, nigdy wśród przesłanych przez Ciebie czcionek, i nie pojawia się na liście czcionek marki.

Wiersz poleceń, aplikacja terminalowa i serwer MCP odczytują te same pliki z dysku, więc nie wymagają pobierania.

<!--i:eti-eye-->
## Na stronie i w eksporcie

Strona używa tej samej czcionki zastępczej co eksport, więc wiersz zawierający takie litery ma tę samą szerokość w obu. Tylko na tej kanwie Lolly dodaje czcionkę zastępczą po czcionkach systemu projektowego i przed każdą czcionką systemową. Narzędzie, które ustawia własną listę czcionek w stylach lub elementach, otrzymuje czcionkę zastępczą w tym samym miejscu. Kanwa, której znaki obsługuje system projektowy, zachowuje niezmienioną listę czcionek.

Strona nie zmienia listy czcionek, gdy zaczyna się ona od czcionki systemowej, takiej jak `system-ui` lub Helvetica, ponieważ eksport rysuje ten tekst czcionkami systemu projektowego, a strona nie.

W PDF słowa stają się konturami w czcionce zastępczej przy dowolnym ustawieniu tekstu, ponieważ żywy tekst PDF nie może zawierać pisma, którego nie ma w osadzonej czcionce. W SVG, EMF, EPS, DXF i WMF stają się konturami zawsze wtedy, gdy tekst jest zamieniany na kontury. Przy zachowaniu żywego tekstu rysują je własne czcionki czytnika. Gdy czcionka zastępcza narysowała część eksportu, panel eksportu pokazuje informację taką jak:

> Tekst japoński jest rysowany czcionką Noto Sans JP, ponieważ czcionki tego systemu projektowego nie mają tych liter.

Wiersz poleceń wypisuje to samo zdanie jako informację.

<!--i:eti-image-->
## Co pozostaje obrazem

Znak spoza czterech krajowych zestawów, na przykład 𠮷 lub znak z uzupełniającego zestawu Hongkongu, nie ma czcionki zastępczej. Rzadkie znaki, takie jak 𠮷, znaki dodane dla Hongkongu w jego zestawie uzupełniającym i pisma bez czcionki zastępczej, takie jak tamilskie, etiopskie lub syryjskie, są traktowane tak samo. Czcionki zastępczej nie ma też pismo takie jak tamilskie, etiopskie lub syryjskie. W PDF wiersz zawierający taki tekst trafia jako obraz 300 dpi, a panel eksportu wymienia pisma. W SVG fragment pozostaje żywym tekstem, który rysują własne czcionki czytnika.

::: details W eksportach EPS, WMF i EMF
EPS, WMF lub EMF z włączonym **Outline fonts** nie ma żywego tekstu, do którego mógłby się odwołać, więc fragment również trafia jako obraz 300 dpi. Obraz nanosi kolor tekstu tylko tam, gdzie są litery, więc tło jest widoczne między nimi. Panel eksportu wymienia pisma. Obraz jest rysowany tylko bez obrotu i pochylenia, więc obrócony lub pochylony fragment zatrzymuje eksport z komunikatem, który go cytuje. W WMF lub EMF obraz to para operacji bitmapowych: maska i naniesienie koloru. Microsoft Office i LibreOffice rysują je zgodnie z zamierzeniem. Aplikacja, która je ignoruje, na przykład Inkscape, pokazuje słowa na białym prostokącie.

EMF z wyłączonym **Outline fonts** zachowuje taki fragment jako żywy tekst, który rysują własne czcionki czytnika. Wyjątkiem jest fragment, którego żywy tekst EMF nie potrafi zapisać, na przykład tekst z odstępami między literami. Lolly zamienia ten fragment na kontury, więc fragment, którego nie potrafi narysować żadna czcionka, również trafia tam jako obraz.
:::

::: warning Eksport DXF zatrzymuje się przy tekście, którego nie potrafi narysować żadna czcionka
DXF trafia do maszyn tnących i oprogramowania CAD, które potrzebują konturów, więc fragment, którego nie potrafi narysować żadna czcionka, zatrzymuje eksport DXF. Komunikat cytuje fragment i podaje jego pismo. Dodaj czcionkę z tymi literami lub wyeksportuj SVG albo PDF.
:::

<!--i:eti-checklist-->
## Sprawdzenie przed eksportem

Karta **Before you export** w Lolly Design i kontrole `render` w `lolly check` zgłaszają tekst, którego nie potrafi narysować żadna czcionka. Uwzględniają czcionki zastępcze tak samo jak eksport, na podstawie tych samych list znaków poszczególnych czcionek, więc tekst rysowany czcionką zastępczą nie jest zgłaszany. Pismo bez czcionki zastępczej, takie jak tamilskie, oraz znak chiński, japoński lub koreański spoza krajowych zestawów nadal są zgłaszane, ponieważ eksport rysuje je jako obraz lub żywy tekst, a eksport DXF się na nich zatrzymuje. Kontrola odczytuje te listy z katalogu i nie pobiera żadnej czcionki.

<!--i:eti-stamp-->
## Licencje i oznaczenia autorstwa

Każda czcionka zastępcza jest objęta SIL Open Font License 1.1. Każdy wpis katalogu zapisuje tę licencję ze skrótem jej tekstu, więc reguły praw w [Prawach twórców i oznaczeniach autorstwa](/info/creative-rights.html) odczytują licencję jak licencję każdej innej czcionki. Teksty licencji znajdują się obok czcionek. Pliki Noto Sans nie deklarują żadnej Reserved Font Name. Czcionki chińskie, japońskie i koreańskie należą do Adobe i zastrzegają nazwę Source. Przycięte pliki zachowują swoje nazwy Noto, które nie używają tej nazwy.

Licencja stwierdza, że jej warunki nie dotyczą dokumentów utworzonych przy użyciu czcionek. Eksport zawiera tylko kontury użytych liter, tak jak w przypadku czcionek systemu projektowego. Lolly nie dodaje programu czcionki, informacji o autorstwie ani nowego wpisu w poświadczeniu treści dla czcionki zastępczej.
