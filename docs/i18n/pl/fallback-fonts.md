# Czcionki zastępcze

Czcionki systemu projektowego często pokrywają tylko część pism świata. Lolly Demo ustawia nagłówki w Outfit, a tekst w SUSE, i żadna z tych czcionek nie ma liter cyrylicy, greki, arabskiego, hebrajskiego, dewanagari, bengalskiego, tajskiego, chińskiego, japońskiego ani koreańskiego. Gdy dokument zawiera litery, których czcionki jego systemu projektowego nie potrafią narysować, Lolly rysuje je otwartą czcionką Noto, dzięki czemu eksport zachowuje je jako wektorowe kontury, zamiast zamieniać słowa w obraz.

Czcionki systemu projektowego zawsze mają pierwszeństwo, w kolejności, w jakiej system je wymienia. Outfit nie ma liter wietnamskich, więc wietnamski nagłówek bierze je z SUSE, następnej czcionki z listy Lolly Demo. Czcionka zastępcza rysuje tylko znaki, których żadna z tych czcionek nie potrafi narysować, więc czcionka marki zachowuje każdą swoją literę, cyfrę i znak, nawet wewnątrz słowa w innym piśmie. Czcionka marki, która ma dany znak chiński, zachowuje także ten znak.

## Co jest w zestawie

Piętnaście czcionek, wszystkie z Google Fonts w przypiętym commicie i wszystkie na licencji SIL Open Font License 1.1. Przy każdym pliku podano rozmiar pobrania.

| Pismo | Czcionka | Wersja | Pobranie |
|---|---|---|---|
| Arabskie, w tym litery urdu i perskie | Noto Sans Arabic | 2.012 | 211 KB |
| Hebrajskie | Noto Sans Hebrew | 3.001 | 37 KB |
| Dewanagari (hindi, marathi, nepalski) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengalskie | Noto Sans Bengali | 3.011 | 139 KB |
| Tajskie | Noto Sans Thai | 2.002 | 62 KB |
| Cyrylica | Noto Sans, litery cyrylicy | 2.015 | 115 KB, kursywa 132 KB |
| Greckie | Noto Sans, litery greckie | 2.015 | 77 KB, kursywa 83 KB |
| Łacińskie, w tym wietnamskie i inne litery z akcentami | Noto Sans, litery łacińskie | 2.015 | 316 KB, kursywa 350 KB |
| Chiński uproszczony, znaki GB 2312 | Noto Sans SC | 2.004 | 2,0 MB |
| Chiński tradycyjny, znaki Big5 | Noto Sans TC | 2.004 | 3,8 MB |
| Japońskie, znaki Shift_JIS | Noto Sans JP | 2.004 | 2,2 MB |
| Koreańskie, każda sylaba hangul i znaki KS X 1001 | Noto Sans KR | 2.004 | 2,5 MB |

Oś grubości każdej czcionki jest zachowana w całości, więc każda grubość, o którą prosi projekt, nadal się rysuje, a pogrubiony nagłówek chiński, japoński lub koreański jest pogrubiony. Oś szerokości czcionek Noto Sans jest ustawiona na stałe na normalną, co zmniejsza każdy plik o połowę; czcionki chińskie, japońskie i koreańskie nie mają osi szerokości. Noto Sans jest podzielona według pisma, więc słowo cyrylicą pobiera tylko litery cyrylicy. Kontury są oryginalnymi konturami z upstreamu, bez zmian.

Czcionki leżą w jednym wspólnym folderze, `community/fallback-fonts`, serwowanym każdemu systemowi projektowemu z `/catalog/packs/fallback-fonts/`, tak samo jak wspólne zestawy emoji. `scripts/import-fallback-fonts.ts` buduje pliki z czcionek upstreamu przypiętych w `scripts/data/fallback-fonts.json`, sprawdza każdy plik z upstreamu względem zapisanego SHA-256 i zapisuje teksty licencji obok czcionek.

## Chiński, japoński i koreański

Pełna czcionka chińska, japońska lub koreańska ma od 9,6 MB do 17,8 MB, więc każdą z nich przycięto do narodowego zestawu znaków, z którego jej czytelnicy korzystają na co dzień, plus interpunkcji, kany, form pełnej szerokości i symboli zwykłego tekstu:

- Chiński uproszczony: GB 2312, 6763 powszechne hanzi i jego symbole, łącznie 7522 znaki.
- Chiński tradycyjny: Big5, jego 13 053 hanzi i symbole, łącznie 13 629 znaków. Hongkoński Zestaw Znaków Uzupełniających nie jest uwzględniony.
- Japoński: Shift_JIS tak, jak czytają go Windows i sieć, czyli JIS X 0208 z dodatkami NEC i IBM, których potrzebują nazwiska takie jak 髙 i 﨑, każda kana i półszerokie katakana, łącznie 7432 znaki.
- Koreański: wszystkie 11 172 sylaby hangul i KS X 1001 z jego 4888 hanja, łącznie 17 082 znaki.

Liter łacińskich, greckich i cyrylicy w tych czterech czcionkach brakuje, ponieważ rysują je czcionki systemu projektowego i czcionki wymienione wyżej. Zestawy są odczytywane z plików indeksu Encoding Standard w przypiętym commicie, więc przebudowa daje te same pliki.

Chiński, japoński i koreański dzielą większość znaków, ale każdy wiele z nich rysuje inaczej. Ten sam znak 直 pisze się w jeden sposób po chińsku, a w inny po japońsku. Dlatego jeden przebieg tekstu bierze wszystkie wspólne znaki z jednej z tych czcionek, nigdy z dwóch, a Lolly wybiera ją w tej kolejności:

1. Język przebiegu, z `lang` jego elementu lub najbliższego elementu wokół niego w dokumencie. Ustawia go ustawienie języka narzędzia, takie jak Language w certyfikacie. Język własnego interfejsu Lolly i język systemu projektowego się nie liczą, więc dokument eksportuje się tak samo dla wszystkich.
2. Pismo przebiegu: kana oznacza japoński, a hangul koreański. Gdy sam przebieg nie ma żadnego z nich, czytany jest cały dokument, więc nagłówek z samych kanji w japońskim dokumencie jest rysowany po japońsku. Dokument, który zawiera zarówno kanę, jak i hangul, niczego tu nie rozstrzyga.
3. Znak używany tylko w chińskim tradycyjnym, taki jak 體 lub 說, w przebiegu lub w dokumencie, oznacza chiński tradycyjny, chyba że ten sam tekst zawiera też znak używany tylko w chińskim uproszczonym.
4. W przeciwnym razie chiński uproszczony.

Znak, którego wybrana czcionka nie ma, nigdy nie jest brany z jednej z trzech pozostałych. Zostaje obrazem, jak opisano niżej. Kana lub hangul, których wybrana czcionka nie ma, na przykład koreańskie słowa w wierszu oznaczonym jako japoński, mogą nadal pochodzić z czcionki japońskiej lub koreańskiej, ale tylko wtedy, gdy ta czcionka nie narysowałaby żadnego wspólnego znaku z tego wiersza.

Na stronie kanwa zawierająca dwa z tych języków wymienia obie czcionki, a przeglądarka rysuje wspólne znaki pierwszą z nich. Eksport rysuje każdy przebieg jego własną.

## Kiedy czcionka się pobiera

Nic się nie pobiera, dopóki dokument nie zawiera znaku, którego nie potrafi narysować żadna czcionka jego systemu projektowego. Dokument po angielsku lub w dowolnym języku, który pokrywa jego system projektowy, nigdy nie pobiera czcionki zastępczej. Symbol w angielskim wierszu, taki jak ★ lub ※, nigdy nie pobiera czcionki chińskiej, japońskiej ani koreańskiej.

Gdy dokument potrzebuje takiej czcionki po raz pierwszy, Lolly pobiera tę jedną czcionkę, dla tego jednego pisma, i zachowuje ją na Twoim urządzeniu. Dokument japoński pobiera samą czcionkę japońską, 2,2 MB, a tradycyjny chiński czcionkę tradycyjną, 3,8 MB. Od tego momentu pismo rysuje się offline, a czcionka zostaje po uporządkowaniu katalogu. Czcionka jest przechowywana razem z własnymi plikami katalogu, nigdy wśród czcionek, które wgrałeś, więc nie pojawia się na liście czcionek Twojej marki.

Wiersz poleceń, aplikacja terminalowa i serwer MCP czytają te same pliki z dysku, więc nie potrzebują pobierania.

## Na stronie i w eksporcie

Strona używa tej samej czcionki zastępczej co eksport. Bez tego przeglądarka rysuje takie litery czcionką systemową, a eksport używa Noto, i wiersz, który je zawiera, zmienia szerokość między jednym a drugim. Lolly dodaje czcionkę zastępczą na koniec listy czcionek systemu projektowego tylko na tej kanwie, po własnych czcionkach systemu projektowego i przed każdą czcionką systemową. Narzędzie, które ustawia własną listę czcionek, w swoich stylach lub na swoich elementach, dostaje czcionkę zastępczą w tym samym miejscu: po czcionkach, które podaje lista, i przed każdą czcionką systemową. Kanwa, którą system projektowy pokrywa, zachowuje swoją listę czcionek dokładnie jak wcześniej.

Strona zostawia listę czcionek bez zmian, gdy zaczyna się od czcionki systemowej, takiej jak `system-ui` lub Helvetica, ponieważ eksport rysuje taki tekst czcionkami systemu projektowego, a strona nie.

W PDF słowa stają się konturami rysowanymi czcionką zastępczą, niezależnie od wybranego ustawienia tekstu, ponieważ żywy tekst PDF nie może nieść pisma, którego osadzona czcionka nie ma. W SVG, EMF, EPS, DXF i WMF stają się konturami zawsze, gdy tekst jest zamieniany na kontury; przy tekście pozostawionym jako żywy rysują je własne czcionki czytelnika, jak dotąd. Gdy czcionka zastępcza narysowała część eksportu, panel eksportu pokazuje uwagę taką jak:

> Tekst japoński jest rysowany czcionką Noto Sans JP, ponieważ czcionki tego systemu projektowego nie mają tych liter.

Wiersz poleceń wypisuje to samo zdanie jako uwagę.

## Co zostaje obrazem

Znak spoza czterech narodowych zestawów nie ma czcionki zastępczej. Rzadkie znaki, takie jak 𠮷, znaki dodane dla Hongkongu przez jego zestaw uzupełniający i pisma bez czcionki zastępczej, takie jak tamilskie, etiopskie lub syryjskie, są traktowane tak samo. W PDF wiersz, który zawiera taki znak, trafia jako obraz 300 dpi, a panel eksportu wymienia pisma. W SVG przebieg zostaje żywym tekstem, który rysują własne czcionki czytelnika.

## Kontrola przed eksportem

Karta **Before you export** w Lolly Design oraz kontrole `render` polecenia `lolly check` zgłaszają tekst, którego żadna czcionka nie narysuje. Czcionki zastępcze liczą tak jak eksport, z tych samych list znaków każdej czcionki, więc tekst rysowany przez czcionkę zastępczą nie jest zgłaszany. Pismo bez czcionki zastępczej, takie jak tamilskie, oraz znak chiński, japoński lub koreański spoza zestawów narodowych nadal są zgłaszane, ponieważ eksport rysuje je jako obraz albo jako żywy tekst. Kontrola czyta te listy z katalogu i nie pobiera żadnej czcionki.

## Licencje i uznania autorstwa

Każda czcionka zastępcza jest na licencji SIL Open Font License 1.1, a każdy wpis katalogu zapisuje tę licencję wraz ze skrótem tekstu licencji, więc reguły praw w [Creative rights and credits](/info/creative-rights.html) odczytują licencję jak każdej innej czcionki. Teksty licencji leżą obok czcionek. Pliki Noto Sans nie deklarują Reserved Font Name. Czcionki chińskie, japońskie i koreańskie pochodzą od Adobe i zastrzegają nazwę Source; przycięte pliki zachowują nazwy Noto, które tej nazwy nie używają.

Licencja mówi, że jej warunki nie dotyczą dokumentów wykonanych za pomocą czcionek. Eksport zawiera tylko narysowane kontury używanych liter, tak samo jak w przypadku własnych czcionek systemu projektowego, a Lolly nie dodaje dla czcionki zastępczej żadnego programu czcionki, żadnej linii uznania ani nowego wpisu Content Credentials.
