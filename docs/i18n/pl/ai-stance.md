# Nasze stanowisko wobec AI

Lolly powstało w środku największej zmiany w sposobie tworzenia mediów od czasu prasy drukarskiej, przez ludzi, którzy nie panikują z powodu AI ani nie zachwycają się tą technologią bez tchu. Oto stanowisko projektu, z mechanizmem za każdym zobowiązaniem, abyś mógł sprawdzić, a nie zaufać.

> "Pijemy tak, jakby kran miał zaraz wyschnąć. Nie wyschnie - dzisiejsza AI jest najgorsza, jaka kiedykolwiek będzie. Jeśli przetrwamy powódź, to nie dzięki gromadzeniu tego, co jest w zardzewiałym zbiorniku na wodę u podnóża wzgórza, pełnym osadu. Przetrwamy, nawadniając i odzyskując ***naszą*** ziemię dla dostatniej przyszłości."
>
> - Andy Fitzsimon, współtwórca Lolly

![Superkomórka burzowa nadciągająca nad zagrodą w buszu - zbiornik i szopy poniżej, woda powodziowa już żłobi kanały w suchym polu](/info/the-flood.webp)

%file{Gemini_Generated_Image_vmy7thvmy7thvmy7.png} %entity{Gemini} wygenerowany obraz %sig{podpisany przez %entity{Google LLC}} %entity{Lolly} %act{opened}, %act{watermarked} i %act{wyeksportowała do WebP} jako %file{the-flood.webp} %detail{10,6 MB do 0,8 MB} %sig{podpisany przez %entity{Lolly}} [Zweryfikuj to teraz](/#/verify?src=%2Finfo%2Fthe-flood.webp)

Ścisłość, bo ta strona dowodzi, że ścisłość ma znaczenie: powyższy obraz jest wygenerowany, a nie sfotografowany. Żaden aparat nie był skierowany na to gospodarstwo, bo nie ma gospodarstwa. Opisuje regionalne Queensland w Australii, z promptu z Wielkiej Brytanii, wygenerowane w centrum danych w Stanach Zjednoczonych. Próbuje być wierny miejscu, nie będąc jego zapisem, i ta różnica jest całym powodem, dla którego obraz niesie Content Credentials.

Oto jak to wygląda, gdy sprawdzisz plik. W pliku przetrwało dziewięć kroków: pięć zapisanych przez Google, gdy generowało i oznaczało znakiem wodnym obraz, potem cztery zapisane przez Lolly, gdy otwierało, tworzyło, oznaczało i konwertowało wersję na tej stronie. Lolly niczego nie wygenerowało, a jego wpis tak mówi.

![Historia zmian, którą Lolly odczytuje z gotowego pliku - pięć kroków zapisanych przez Google, potem cztery przez Lolly, kończąc na pliku WebP na tej stronie](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

W obrazie Andy'ego postawa niedoboru wobec AI to picie zatęchłej wody ze zbiornika, podczas gdy woda powodziowa pędzi po równinach. Wygenerowana treść stanie się praktycznie nieskończona. Gdy coś staje się nieskończone, jego wartość przenosi się na to, co pozostaje wokół niego rzadkie: zaufanie, proweniencję, spójność marki i ludzki osąd. Lolly nie jest większym wiadrem na powódź. Jest nawadnianiem: kanałami, które kierują wodę, i glebą, w której naprawdę coś rośnie.

## Stanowisko w pięciu zobowiązaniach

- <!--i:layers--> **AI jest mile widziane jako wkład, nigdy jako podszywanie się.** Agenci są pełnoprawnymi użytkownikami Lolly: uruchamiają te same narzędzia co ludzie, przez [serwer MCP](/info/mcp.html) i [tryb URL](/info/url-mode.html), w dokładnie tych samych ograniczeniach. Czego żaden agent nie może zrobić, to podać swoje wyniki za coś, czym nie są. [Input, not impersonation](/info/input-not-impersonation.html) wytycza tę linię.
- <!--i:shieldcheck--> **AI się deklaruje.** Gdy AI wygenerowało piksele, eksport to mówi: czytelna maszynowo asercja w Content Credentials pliku i widoczna odznaka GEN AI, gdy ktokolwiek weryfikuje plik. Gdy media zadeklarowane jako wykonane przez AI są umieszczane w projekcie, własne poświadczenie eksportu też to mówi: złożony znak pochodzenia i podpisane, czytelne maszynowo ujawnienie AI. Lolly odczytuje też i pokazuje deklaracje AI plików wykonanych gdzie indziej i oznacza, gdy prawdopodobnie jest obecny znak wodny SynthID, odczytując deklarację, a nie sam znak wodny. Ta sama reguła wiąże własny przepisywacz Lolly działający na urządzeniu: każde zdanie, które napisze, niesie publiczny statystyczny znak wodny w doborze słów, ujawniony tu i w narzędziu, więc tekst napisany przez model pozostaje sam siebie deklarującym nawet jako zwykła kopia tekstowa, a każdy może sprawdzić ten tekst w [Verify](/#/verify) ([jak działa sprawdzanie](/info/what-verify-checks.html#text-reworded-by-lolly)). Schemat jest publiczny z założenia: weryfikacja dla wszystkich, sekrety dla nikogo. Odbiorcy zasługują na to, by wiedzieć, jak wykonano media.
- <!--i:check--> **Proweniencja jest domyślnie włączona.** Eksporty niosą [Content Credentials](/info/content-credentials-identity.html) domyślnie, a nie jako ukryte ustawienie. Łańcuch obejmuje edycje i składniki, więc historia dzieła podróżuje z dziełem. Możesz [sprawdzić to sam](/info/verify-yourself.html) na każdym pliku, który tworzy Lolly.
- <!--i:people--> **Autorami pozostają ludzie.** Słowa, obraz, paleta, decyzja wymagająca osądu: narzędzia skalują ten osąd i nigdy nie zastępują osoby. Automatyzowane są żmudne części: sprawdzanie zgodności z marką, ponowny eksport w każdym rozmiarze, ręczna lokalizacja. To, co zostaje, to autorstwo.
- <!--i:globe--> **Kanały, a nie wiadra.** Dzisiejsze modele to podłoga, a nie sufit, więc odmawiamy budowania czegokolwiek, czego wartość zależy od gromadzenia dostępu do nich. Silnik jest open source, renderuje na Twoim własnym urządzeniu i działa offline. Nie ma fosy modelowej, licznika użycia ani biznesu niedoboru przyczepionego do samej powodzi. Trwałą inwestycją jest infrastruktura wokół wody - i tę infrastrukturę rozdajemy.

## Ludzka decyzja jest sednem

Jednostki kształtują ziemię i naszą historię. Ich wybory, dokonywane po jednym, stają się światem, w którym żyje reszta z nas. Ich czyny tworzą ten świat. Tak działo się wszystko, co kiedykolwiek się wydarzyło.

Dlatego wzmacniamy ludzką decyzję i nigdy nie idziemy na kompromis. Prawo wyboru. Sprawczość. Autonomia. Zdolność decydowania i działania oraz to, by ten czyn był Twój.

Narzędzia tutaj skalują to, co postanowił człowiek. Nie decydują za niego i nigdy po cichu go nie zastępują. Tam, gdzie decyzję przenosi automatyzacja, zapis nadal prowadzi z powrotem do osoby, która ją uruchomiła, bez względu na to, przez ile systemów i zakrętów przeszła po drodze.

Honorujemy to od początku do końca i to zapisujemy: dla historii, dla odpowiedzialności, dla zaufania i dla jutra.

## AI na twoich warunkach

Nigdy nie musisz tu korzystać z AI. Jeśli jednak z niej skorzystasz, obowiązują trzy zasady:

- <!--i:people--> **Ty masz kontrolę.** AI pomaga tylko wtedy, gdy o to poprosisz, i tylko przy elemencie, na który je wskażesz. Nic nie jest rozstrzygane za Ciebie.
- <!--i:check--> **Przestaje kosztować.** Jeśli AI pomoże zrobić coś raz, wynik jest Twój. Użycie go ponownie jest darmowe, ile razy potrzebujesz wyniku.
- <!--i:shieldcheck--> **Pozostaje uczciwe.** Praca wykonana przez AI tak mówi, a to, co tworzysz, niesie Twoje nazwisko, zamiast udawać kogoś innego. Nawet wbudowana pomoc działa w ten sposób: [Ask Lolly](/info/ask.html) odpowiada zdaniem z samego podręcznika i linkiem, nigdy zmyśloną odpowiedzią.

## Czym to nie jest

- <!--i:check--> **Nie jest zakazem.** Narzędzia mogą używać AI tam, gdzie służy to pracy, a agenci są wspieraną grupą odbiorców - zobacz [Agenci AI](/info/ai-agents.html).
- <!--i:seal--> **Nie jest deklaracją czystości.** Lolly odczytuje pochodzenie szeroko i zapisuje je uczciwie; nie udaje, że wykrywa każdy wygenerowany piksel w internecie.
- <!--i:sunburst--> **Nie jest moralną paniką.** Powódź nie jest wrogiem. Wroga jest woda bez przypisanego pochodzenia.

## Sprawdź te zobowiązania sam

Każde powyższe zobowiązanie jest egzekwowane w otwartej bazie kodu, a nie w PDF z polityką: ścieżka proweniencji, oznaczanie GEN AI i gwarancja braku trackerów mają testy, a strona [Verify It Yourself](/info/verify-yourself.html) prowadzi przez sprawdzanie twierdzeń na prawdziwym eksporcie.
