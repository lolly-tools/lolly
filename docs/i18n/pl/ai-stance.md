# Nasze stanowisko wobec AI

Lolly powstało w trakcie największej zmiany w sposobie tworzenia mediów od czasu prasy drukarskiej, stworzone przez ludzi, którzy ani nie panikują z powodu AI, ani nie zachwycają się bezkrytycznie tą technologią. Oto stanowisko projektu wraz z mechanizmem stojącym za każdym zobowiązaniem, abyś mógł sprawdzić zamiast wierzyć.

> „Pijemy tak, jakby woda w kranie miała się skończyć w każdej chwili. Nie skończy się - dzisiejsze AI jest najgorsze, jakie kiedykolwiek będzie. Jeśli przetrwamy powódź, to nie dzięki gromadzeniu tego, co jest w zardzewiałym zbiorniku na wodę u podnóża wzgórza, pełnym osadu. Przetrwamy dzięki nawadnianiu i odzyskiwaniu ***naszej*** ziemi dla dostatniej przyszłości”.
>
> - Andy Fitzsimon, współtwórca Lolly

![Burza superkomórkowa nad gospodarstwem na australijskim pustkowiu - zbiornik i szopy poniżej, woda powodziowa już żłobi kanały w suchym pastwisku](/info/the-flood.webp)

%file{Gemini_Generated_Image_vmy7thvmy7thvmy7.png} %entity{Gemini} wygenerowany obraz %sig{signed by %entity{Google LLC}} %entity{Lolly} %act{opened}, %act{watermarked} i %act{exported to WebP} jako %file{the-flood.webp} %detail{10.6 MB down to 0.8 MB} %sig{signed by %entity{Lolly}} [Sprawdź teraz](/#/verify?src=%2Finfo%2Fthe-flood.webp)

Ujmując to precyzyjnie, bo ta strona przekonuje, że precyzja ma znaczenie: powyższy obraz został wygenerowany, a nie sfotografowany. Żaden aparat nie był skierowany na to gospodarstwo, ponieważ ono nie istnieje. Przedstawia prowincję Queensland w Australii, na podstawie polecenia z Wielkiej Brytanii, wygenerowany w centrum danych w Stanach Zjednoczonych. Próbuje wiernie oddać miejsce, nie będąc jego zapisem, i właśnie to rozróżnienie jest powodem, dla którego obraz zawiera Content Credentials.

Tak to wygląda, gdy sprawdzasz plik. W pliku zachowało się dziewięć kroków: pięć zapisanych przez Google podczas generowania obrazu i dodawania znaku wodnego, potem cztery zapisane przez Lolly podczas otwierania, tworzenia, oznaczania i konwersji wersji na tej stronie. Lolly niczego nie wygenerowało i jego wpis o tym mówi.

![Historia zmian, którą Lolly odczytuje z gotowego pliku - pięć kroków zapisanych przez Google, potem cztery przez Lolly, zakończone plikiem WebP na tej stronie](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

W obrazie Andy’ego podejście do AI oparte na niedoborze to picie zepsutej wody ze zbiornika, gdy woda powodziowa pędzi przez równiny. Ilość generowanych treści wkrótce stanie się praktycznie nieskończona. Gdy coś staje się nieskończone, jego wartość przenosi się na to, co wokół nadal jest rzadkie: zaufanie, proweniencję, spójność marki i ludzki osąd. Lolly nie jest większym wiadrem na powódź. Jest nawadnianiem: kanałami kierującymi wodą i glebą, na której coś rzeczywiście rośnie.

<!--i:eti-checklist-->
## Stanowisko w pięciu zobowiązaniach

- <!--i:layers--> **AI jest mile widziane jako źródło danych, nigdy jako podszywanie się.** Agenci są pełnoprawnymi użytkownikami Lolly: uruchamiają te same narzędzia co ludzie, przez [serwer MCP](/info/mcp.html) i [tryb URL](/info/url-mode.html), w dokładnie tych samych granicach. Żaden agent nie może przedstawiać swojego wyniku jako czegoś, czym on nie jest. [Dane wejściowe, nie podszywanie się](/info/input-not-impersonation.html) wyznacza tę granicę.
- <!--i:shieldcheck--> **AI ujawnia swój udział.** Gdy AI wygenerowało piksele, eksport o tym mówi: deklaracja odczytywalna maszynowo w Content Credentials pliku i widoczna odznaka GEN AI, gdy ktokolwiek weryfikuje plik. Gdy media zadeklarowane przez Ciebie jako stworzone przez AI trafiają do projektu, własne poświadczenie eksportu też o tym mówi: oznaczenie pochodzenia złożonej treści i podpisane, odczytywalne maszynowo ujawnienie udziału AI. Lolly odczytuje też i pokazuje deklaracje AI z plików utworzonych gdzie indziej oraz sygnalizuje prawdopodobną obecność znaku wodnego SynthID, odczytując deklarację, a nie sam znak wodny. Ta sama zasada obowiązuje własne narzędzie Lolly do przeredagowania tekstu na urządzeniu: każde napisane przez nie zdanie zawiera publiczny statystyczny znak wodny w doborze słów, ujawniony tutaj i w narzędziu, więc tekst napisany przez model nadal ujawnia swoje pochodzenie nawet jako kopia w zwykłym tekście. Każdy może sprawdzić ten tekst w [Lolly Verify](/#/verify) ([jak działa sprawdzanie](/info/what-verify-checks.html#text-reworded-by-lolly)). Mechanizm jest z założenia publiczny: weryfikacja dla wszystkich, sekrety dla nikogo. Odbiorcy mają prawo wiedzieć, jak powstały media.
- <!--i:check--> **Proweniencja jest domyślnie włączona.** Eksporty domyślnie zawierają [Content Credentials](/info/content-credentials-identity.html), a nie dopiero po znalezieniu ukrytego ustawienia. Łańcuch obejmuje zmiany i składniki, więc historia dzieła podróżuje z nim. Możesz [sprawdzić to samodzielnie](/info/verify-yourself.html) w każdym pliku tworzonym przez Lolly.
- <!--i:people--> **Ludzie pozostają autorami.** Słowa, obraz, paleta, decyzja wymagająca osądu: narzędzia zwiększają skalę tego osądu i nigdy nie zastępują człowieka. Automatyzowane są żmudne części: sprawdzanie zgodności z marką, ponowny eksport w każdym rozmiarze, ręczna lokalizacja. Pozostaje autorstwo.
- <!--i:globe--> **Kanały, nie wiadra.** Dzisiejsze modele to dolna granica możliwości, nie górna, więc odmawiamy budowania czegokolwiek, czego wartość zależy od gromadzenia wyłącznego dostępu do nich. Silnik ma otwarty kod źródłowy, renderuje na Twoim urządzeniu i działa offline. Nie ma przewagi opartej na wyłączności modelu, licznika użycia ani biznesu opartego na niedoborze samej powodzi. Trwałą inwestycją jest infrastruktura wokół wody - i tę infrastrukturę udostępniamy bezpłatnie.

<!--i:eti-user-check-->
## Chodzi o ludzką decyzję

Jednostki kształtują ziemię i naszą historię. Ich wybory, podejmowane jeden po drugim, stają się światem, w którym żyje reszta z nas. Ich działania tworzą ten świat. Tak zawsze działo się wszystko.

Dlatego wzmacniamy ludzką decyzyjność i nigdy w tej sprawie nie idziemy na kompromis. Prawo wyboru. Sprawczość. Autonomia. Zdolność do decydowania i działania oraz do tego, by to działanie było Twoje.

Narzędzia tutaj pozwalają powielać to, o czym zdecydował człowiek, i nigdy po cichu nie decydują za niego. Gdy decyzję realizuje automatyzacja, zapis nadal prowadzi do osoby, która ją uruchomiła, niezależnie od liczby systemów i zakrętów po drodze.

Przestrzegamy tego od początku do końca i to zapisujemy: dla historii, odpowiedzialności, zaufania i przyszłości.

<!--i:eti-sliders-->
## AI na Twoich warunkach

AI nigdy nie jest tu potrzebna. Jeśli ją wybierzesz, obowiązują trzy zasady:

- <!--i:people--> **Ty masz kontrolę.** AI pomaga tylko wtedy, gdy o to poprosisz, i tylko przy wskazanym fragmencie. Nic nie jest rozstrzygane za Ciebie.
- <!--i:check--> **Koszty się kończą.** Jeśli AI raz pomoże coś stworzyć, wynik jest Twój. Ponowne użycie jest darmowe, niezależnie od tego, ile razy potrzebujesz wyniku.
- <!--i:shieldcheck--> **Wszystko jest jawne.** Materiał stworzony przez AI jest tak oznaczony, a to, co tworzysz, nosi Twoje nazwisko, zamiast udawać cudzą pracę. Tak działa nawet wbudowana pomoc: [Ask Lolly](/info/ask.html) odpowiada zdaniem z podręcznika i linkiem, nigdy zmyśloną odpowiedzią.

<!--i:eti-info-->
## Czym to nie jest

- <!--i:check--> **To nie zakaz.** Narzędzia mogą używać AI tam, gdzie służy to pracy, a agenci są wspieraną grupą odbiorców - zobacz [Agenci AI](/info/ai-agents.html).
- <!--i:seal--> **To nie deklaracja czystości.** Lolly odczytuje szeroki zakres danych o proweniencji i uczciwie je zapisuje; nie udaje, że wykrywa każdy wygenerowany piksel w internecie.
- <!--i:sunburst--> **To nie panika moralna.** Zalew treści nie jest wrogiem. Jest nim brak informacji o ich źródle.

<!--i:eti-search-->
## Sprawdź te zobowiązania samodzielnie

Każde z powyższych zobowiązań jest egzekwowane w otwartym kodzie, a nie w dokumencie PDF z polityką: ścieżka proweniencji, oznaczanie GEN AI i gwarancja braku modułów śledzących są objęte testami, a strona [Sprawdź samodzielnie](/info/verify-yourself.html) prowadzi przez weryfikację tych deklaracji na rzeczywistym eksporcie.
