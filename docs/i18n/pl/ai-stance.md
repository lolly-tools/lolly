# Nasze stanowisko wobec AI

Lolly powstało w środku największej zmiany w sposobie tworzenia mediów od czasów prasy drukarskiej, stworzone przez ludzi, którzy nie panikują z powodu AI, ale też nie są nią zachwyceni bez umiaru. Ta strona wprost przedstawia stanowisko projektu i do każdego twierdzenia dodaje mechanizm, który je egzekwuje, więc możesz to zweryfikować, a nie tylko zaufać.

> "Pijemy tak, jakby kran miał zaraz wyschnąć. Nie wyschnie - dzisiejsza AI jest najgorsza, jaka kiedykolwiek będzie. Jeśli przetrwamy powódź, to nie dzięki gromadzeniu tego, co jest w zardzewiałym zbiorniku na wodę u podnóża wzgórza, pełnym osadu. Przetrwamy, nawadniając i odzyskując ***naszą*** ziemię dla dostatniej przyszłości."
>
> - Andy Fitzsimon, współtwórca Lolly

![Superkomórka burzowa nadciągająca nad zagrodą w buszu - zbiornik i szopy poniżej, woda powodziowa już żłobi kanały w suchym polu](/info/the-flood.webp)

%file{Gemini_Generated_Image_vmy7thvmy7thvmy7.png} %entity{Gemini} wygenerowany obraz %sig{podpisany przez %entity{Google LLC}} %entity{Lolly} %act{opened}, %act{resized} i %act{wyeksportowała do WebP} jako %file{the-flood.webp} %detail{10,6 MB do 0,8 MB} %sig{podpisany przez %entity{Lolly}} [Zweryfikuj to teraz](/#/verify?src=%2Finfo%2Fthe-flood.webp)

Dla precyzji, bo ta strona twierdzi, że precyzja ma znaczenie: obraz powyżej jest wygenerowany, a nie sfotografowany. Żaden aparat nie był skierowany na tę zagrodę, bo żadnej takiej zagrody nie ma. Przedstawia region Queensland w Australii, na polecenie z Wielkiej Brytanii, wygenerowany w centrum danych w Stanach Zjednoczonych. Stara się być wierny miejscu, nie będąc jego zapisem, i to rozróżnienie jest całym powodem, dla którego mówią o tym jego Content Credentials.

Oto jak to wygląda, gdy to sprawdzisz. W pliku zachowało się dziewięć kroków: pięć zapisanych przez Google podczas generowania i znakowania obrazu, potem cztery zapisane przez Lolly, gdy otwierało, tworzyło, oznaczało i konwertowało wersję na tej stronie. Lolly niczego nie wygenerowało, i jego wpis to potwierdza.

![Historia zmian, którą Lolly odczytuje z gotowego pliku - pięć kroków zapisanych przez Google, potem cztery przez Lolly, kończąc na pliku WebP na tej stronie](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Metafora powodzi u Andy'ego jest taka: postawa niedoboru wobec AI - inwestować wszystko w garstkę, dziś się umniejszać, a martwić potem - to picie zepsutej wody ze zbiornika, podczas gdy deszcz już pada, a woda powodziowa pędzi przez równiny w twoją stronę. Treść generowana zaraz stanie się praktycznie nieskończona. Gdy coś staje się nieskończone, jego wartość przenosi się na to, co pozostaje wokół rzadkie: zaufanie, pochodzenie, spójność marki i ludzki osąd. Lolly nie jest większym wiadrem na powódź. Jest nawadnianiem - kanałami, które kierują wodę, i glebą, na której rzeczy naprawdę rosną.

## Stanowisko w pięciu zobowiązaniach

- <!--i:layers--> **AI jest mile widziana jako dane wejściowe, nigdy jako podszywanie się.** Agenci są pełnoprawnymi użytkownikami Lolly: uruchamiają te same narzędzia co ludzie, przez [serwer MCP](/info/mcp.html) i [tryb URL](/info/url-mode.html), w dokładnie tych samych ograniczeniach. Narzędzie, które nie może wygenerować zasobu niezgodnego z marką dla człowieka, nie może wygenerować go też dla agenta - bariery ochronne nie obchodzi, kto rzuca piłką. Czego żaden agent nie może zrobić, to podać swój wynik za coś, czym on nie jest.
- <!--i:shieldcheck--> **AI się deklaruje.** Gdy piksele wygenerowała AI, eksport to mówi wprost: odczytywalne maszynowo stwierdzenie w Content Credentials pliku i widoczna plakietka GEN AI, gdy ktokolwiek go weryfikuje. Lolly odczytuje też i ujawnia deklaracje AI plików utworzonych gdzie indziej oraz oznacza, gdy prawdopodobnie obecny jest znak wodny SynthID - odczytując deklarację, a nie sam znak wodny. Ta sama zasada wiąże własny, działający na urządzeniu przepisywacz tekstu Lolly: każde napisane przez niego zdanie niesie publiczny statystyczny znak wodny w doborze słów, ujawniony tutaj i w samym narzędziu, więc tekst napisany przez model pozostaje samodeklarujący się nawet jako zwykła kopia tekstowa - a każdy może to sprawdzić na stronie [Weryfikacja](/info/verify-yourself.html). Ten schemat jest publiczny z założenia: weryfikacja dla każdego, sekrety dla nikogo. Odbiorcy zasługują na to, by wiedzieć, jak powstały media - to zdanie pojawia się na naszej stronie [Projektowanie inkluzywne](/info/inclusive-design.html) jako zobowiązanie etyczne, i właśnie to czyni je realnym. A gdy media, które zadeklarowałeś jako stworzone przez AI, zostają umieszczone w projekcie, własny certyfikat eksportu też to mówi: złożony znak pochodzenia i podpisane, odczytywalne maszynowo ujawnienie AI.
- <!--i:check--> **Pochodzenie jest domyślnie włączone.** Eksporty domyślnie niosą [Content Credentials](/info/content-credentials-identity.html), a nie jako ukryte ustawienie. Łańcuch obejmuje edycje i składniki, więc historia dzieła podróżuje razem z nim. Możesz [zweryfikować to sam](/info/verify-yourself.html) na dowolnym pliku wyprodukowanym przez Lolly.
- <!--i:people--> **Ludzie pozostają autorami.** Każde dane wejściowe to ostatecznie decyzja, wyzwolona gdzieś przez człowieka, bez względu na to, ile systemów czy zakrętów było potrzebnych, by tu dotrzeć. Agent może ponieść decyzję daleko. Nie może jej zapoczątkować. Słowa, obraz, paleta, wybór, który wymagał osądu: narzędzia skalują ten osąd, nie zastępują go. To, co żmudne, jest tym, co zostaje zautomatyzowane: sprawdzanie zgodności z marką, ponowny eksport w każdym rozmiarze, ręczna lokalizacja. To, co pozostaje, to autorstwo.
- <!--i:globe--> **Kanały, nie zbiorniki.** Dzisiejsze modele są podłogą, nie sufitem, więc odmawiamy budowania czegokolwiek, czego wartość zależy od gromadzenia dostępu do nich. Silnik jest open source, renderuje na Twoim własnym urządzeniu i działa offline. Nie ma fosy modelowej, nie ma licznika użycia, nie ma biznesu opartego na niedoborze przypiętego do samej powodzi. Trwałą inwestycją jest infrastruktura wokół wody - i właśnie tę infrastrukturę oddajemy za darmo.

## Ludzka decyzja jest sednem

Powiedzmy to jasno, co leży u podstaw każdego zobowiązania powyżej.

Jednostki kształtują ziemię i naszą historię. Ich wybory, podejmowane jeden po drugim, stają się światem, w którym żyjemy my wszyscy. To ich działania go tworzą. To nie sentyment, tak po prostu zawsze działo się wszystko.

Dlatego wzmacniamy ludzką decyzję i jej nie kompromitujemy. Prawo do wyboru. Sprawczość. Autonomia. Zdolność do decydowania i działania, i to, żeby ten czyn był twój.

Narzędzia tutaj skalują to, co postanowił człowiek. Nie decydują za niego i nigdy po cichu go nie zastępują. Tam, gdzie decyzję przenosi automatyzacja, zapis nadal prowadzi z powrotem do osoby, która ją uruchomiła, bez względu na to, przez ile systemów i zakrętów przeszła po drodze.

Honorujemy to od początku do końca i to zapisujemy: dla historii, dla odpowiedzialności, dla zaufania i dla jutra.

## AI na twoich warunkach

Nigdy nie musisz tu korzystać z AI. Jeśli jednak z niej skorzystasz, obowiązują trzy zasady:

- <!--i:people--> **Masz kontrolę.** AI pomaga tylko wtedy, gdy o to poprosisz, i tylko w tym fragmencie, na który wskażesz. Nic nie jest decydowane za ciebie.
- <!--i:check--> **Przestaje kosztować.** Jeśli AI pomoże coś stworzyć raz, wynik jest twój. Ponowne użycie jest darmowe, bez względu na to, ile razy tego potrzebujesz.
- <!--i:shieldcheck--> **Pozostaje uczciwa.** Fragment stworzony przez AI sam o tym mówi, a to, co tworzysz, niesie twoje nazwisko, zamiast udawać kogoś innego. Nawet wbudowana pomoc działa w ten sposób: [Ask Lolly](/info/ask.html) odpowiada własnym zdaniem z podręcznika i linkiem, nigdy zmyśloną odpowiedzią.

## Czym to nie jest

- <!--i:check--> **Nie jest zakazem.** Narzędzia mogą używać AI tam, gdzie służy to pracy, a agenci są wspieraną grupą odbiorców - zobacz [Agenci AI](/info/ai-agents.html).
- <!--i:seal--> **Nie jest deklaracją czystości.** Lolly odczytuje pochodzenie szeroko i zapisuje je uczciwie; nie udaje, że wykrywa każdy wygenerowany piksel w internecie.
- <!--i:sunburst--> **Nie jest moralną paniką.** Powódź nie jest wrogiem. Wroga jest woda bez przypisanego pochodzenia.

## Jak rozliczać nas z tego

Każde zobowiązanie powyżej jest egzekwowane w otwartym kodzie źródłowym, nie w dokumencie polityki PDF: ścieżka pochodzenia, oznaczenia GEN AI i gwarancja braku trackerów - wszystko to jest objęte testami, a strona [Zweryfikuj to sam](/info/verify-yourself.html) prowadzi cię przez sprawdzanie tych twierdzeń na rzeczywistym eksporcie. Jeśli znajdziesz miejsce, w którym kod i ta strona są ze sobą sprzeczne, to kod jest błędem.
