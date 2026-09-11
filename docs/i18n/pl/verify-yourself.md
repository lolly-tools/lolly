# Zweryfikuj to sam

Strony Lolly o prywatności i bezpieczeństwie zawierają twierdzenia: brak analityki, brak śledzenia, pliki nigdy nie opuszczają urządzenia, jedno ciasteczko w całym systemie. Ta strona jest inna: nie prosi cię, byś w to wszystko po prostu uwierzył. To lista procedur, każda z dokładną komendą lub ścieżką kliknięć oraz wynikiem, jaki zobaczysz. Każde twierdzenie tutaj da się obalić w kilka minut, w większości przypadków bez instalowania czegokolwiek.

Jeśli którakolwiek kontrola na tej stronie nie daje pokazanego wyniku, to albo błąd, albo złamana obietnica. [Zgłoś to](#if-a-check-fails) w obu przypadkach, a potraktujemy to z powagą, na jaką zasługuje złamana obietnica.

## Zobacz, jak to działa, w dziesięć sekund

Zanim przejdziemy do procedur, efekt końcowy. Otwórz [`/verify`](/#/verify) i upuść na nie plik - bez przesyłania, bez konta, bez czekania na serwer. Tutaj sprawdza [wygenerowaną burzę w Queensland](/info/ai-stance.html) z naszej strony o stanowisku wobec AI: obraz Gemini, który Lolly otworzyło, zmieniło rozmiar i wyeksportowało. Każda plakietka poniżej została obliczona na urządzeniu, na podstawie samych bajtów pliku.

![Verify na ekranie o szerokości telefonu - obraz burzy, zielony werdykt Made with Lolly oraz plakietki nienaruszonych poświadczeń i niezmienionych bajtów ułożone pod nim](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Werdykt to nie jedna plakietka, lecz niewielki stos, każda z nich to niezależny fakt:

- <!--i:lock--> **Made with Lolly** - poświadczenie jest nienaruszone *i* zapisuje eksport z Lolly.
- <!--i:seal--> **Poświadczenie jest nienaruszone** - podpisany manifest C2PA parsuje się poprawnie, a jego własny podpis roszczenia się weryfikuje.
- <!--i:hash--> **Bajty się nie zmieniły** - hash pliku wciąż zgadza się z tym, co zostało podpisane. Zmień jeden piksel, a ta plakietka się przełączy.
- <!--i:sparkle--> **GEN AI** - te piksele stworzyła maszyna, a plik to potwierdza. Lolly odczytuje to twierdzenie z powrotem, zamiast je ukrywać.

A cała historia podróżuje razem z plikiem. Przetrwało tu dziewięć kroków - pięć zapisanych przez Google podczas generowania i znakowania wodnego obrazu, a potem cztery zapisane przez Lolly podczas otwierania, oznaczania i konwertowania kopii na tej stronie - odczytanych wprost z bajtów, na twoim urządzeniu, i wyrenderowanych jako oś czasu. To ten sam obraz, zweryfikowany w ten sam sposób, co oś czasu C2PA na [stronie o stanowisku wobec AI](/info/ai-stance.html).

![Historia zmian, którą Verify odczytuje z powrotem z obrazu burzy - pięć kroków zapisanych przez Google, potem cztery przez Lolly, kończące się na WebP na tej stronie](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Żadne z tego nie jest jednak deklaracją zaufania - to demonstracja. Reszta tej strony to deklaracja zaufania: każda odznaka powyżej jest odtwarzalna, a tu pokazujemy, jak odtworzyć gwarancje, które za nią stoją.

## W przeglądarce, bez narzędzi

**1. Obserwuj ruch sieciowy.** Otwórz [lolly.tools](https://lolly.tools), otwórz DevTools przeglądarki (F12), przełącz się na kartę **Network** i skorzystaj z narzędzia - wpisz adres URL w [QR Code](/t/qr-code), zmień kolory, wyeksportuj PNG. Każde żądanie pozostaje w obrębie `lolly.tools`: powłoka aplikacji, pliki własne narzędzia, zasoby katalogu. Żadnego hosta analitycznego, żadnego beacona CDN, żadnej usługi czcionek, żadnego endpointu do „raportowania błędów”. To, co wpisujesz w narzędziu, nie pojawia się w **żadnym żądaniu** - renderowanie odbywa się lokalnie.

Uczciwe wyjątki - każdy opt-in, inicjowany przez użytkownika i widoczny w tej samej karcie Network w momencie wystąpienia: dodanie **Google Font** w edytorze marki pobiera tę jedną rodzinę czcionek z Google, po oknie zgody, które informuje o tym dokładnie, jednokrotnie, przed pierwszym pobraniem; kliknięcie **presetu profilu ICC do druku** pobiera ten profil z publicznego rejestru ICC na color.org; odtwarzanie opcjonalnego wbudowanego **radia** strumieniuje ze stacji; wpisanie lokalizacji w **Meeting Planner** wyszukuje to miejsce w usłudze geokodowania open-meteo w celu ustalenia współrzędnych i strefy czasowej, raz na miasto (odpowiedzi zapisywane są na Twoim urządzeniu), a pole wejściowe niesie to zastrzeżenie dokładnie tam, gdzie wpisujesz tekst; a **URL Screenshot** z konieczności wczytuje wpisany przez Ciebie adres URL - to jego zadanie, i widzisz, jak to się dzieje. Narzędzie, które deklaruje możliwość sieciową, może łączyć się wyłącznie z hostami dozwolonymi w jego manifeście, a ten mechanizm działa w trybie fail-closed; żadne obecnie dostarczane narzędzie tego nie deklaruje, więc to egzekwowana przez przeglądarkę Content-Security-Policy jest granicą, która faktycznie utrzymuje powyższą listę w ryzach jej hostów. [Polityka prywatności](/info/privacy.html) zawiera kanoniczną tabelę wszystkich tych przypadków; jej stała zasada mówi, że kontakt sieciowy spoza tej tabeli po prostu nie zachodzi.

**2. Wyciągnij wtyczkę.** Wczytaj aplikację i otwórz jedno lub dwa narzędzia, a następnie przejdź w tryb offline - tryb samolotowy albo DevTools → Network → Offline. Odśwież stronę. Galeria i każde otwarte narzędzie nadal działają, wraz z renderowaniem i eksportem w formatach, których już użyłeś/aś - pliki narzędzia i koder danego formatu są buforowane przy pierwszym użyciu, więc uruchom narzędzie raz online, zanim przetestujesz je offline. To najsilniejsza pojedyncza kontrola na tej stronie: oprogramowanie, które łączy się z domem, nie przetrwa odcięcia kabla.

**3. Policz ciasteczka.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Lista jest pusta - aplikacja nie ustawia żadnych ciasteczek. Możesz też wkleić `document.cookie` w konsoli: otrzymasz `""`. (Jedyne ciasteczko w całym systemie, `lolly_ca_state`, żyje maksymalnie dziesięć minut podczas opcjonalnego logowania tożsamości - usuwane w chwili zakończenia logowania - jest ograniczone do `/api/ca` i jest `HttpOnly`: [polityka prywatności](/info/privacy.html) opisuje je dokładnie.)

**4. Przeczytaj własną pamięć.** Ten sam panel Application: wszystko, co przechowuje Lolly, jest widoczne bezpośrednio przed Tobą - kilkanaście zwykłych kluczy `localStorage` (motyw, język, szerokość paska bocznego, ustawienia dźwięku i widoku, plus zbuforowana kopia publicznego indeksu katalogu narzędzi) oraz Twoje własne dokumenty w IndexedDB. Każda wartość to czytelny ciąg tekstowy lub JSON - nic nie jest zaciemniane, nic nie jest kodowane, by utrudnić odczyt. **Profile → Clear all my data** czyści to wszystko; podobnie działa czyszczenie danych witryny w przeglądarce, ponieważ nie istnieje żadna kopia po stronie serwera, która mogłaby to przetrwać.

**5. Sprawdź, czy istnieje kontakt do zgłaszania podatności.** [`/.well-known/security.txt`](/.well-known/security.txt) odpowiada blokiem kontaktowym [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), a nie stroną HTML.

## Z terminala

**6. Endpoint renderowania odpowiada wyłącznie danymi publicznymi.** Jedyna funkcja serwerowa, która umieszcza dane wpisane przez użytkownika w adresie URL - renderowanie przez hot-link - jest tu aktywna, a [polityka prywatności](/info/privacy.html) wyjaśnia, co to oznacza dla danych, które umieszczasz w linku:

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Przełącznik jest ustawiany per wdrożenie (`LOLLY_DISABLE_RENDER_GET=1`): w instancji, w której ta flaga jest ustawiona, ta sama sonda zwraca `404` - ta różnica to działanie flagi, a nie niespójność.

**7. Powierzchnia serwera jest wyliczalna.** [Server Surface](/info/server-surface.html) wymienia każdą istniejącą trasę po stronie serwera, ze stałą zasadą, że endpoint spoza tej strony nie jest częścią Lolly. Wywołaj je przez `curl`; nie ma tam nic więcej do znalezienia.

## W kodzie źródłowym

Wszystko powyższe wciąż mogłoby być teatrem, gdyby wdrożony kod różnił się od kodu publicznego. Sprawdź więc kod - wdrożenie buduje się z [publicznego repozytorium](https://github.com/lolly-tools/lolly):

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Żadnego trackera, żadnego SDK analitycznego, nigdzie.** Przeszukaj kod, który jest publikowany - silnik, każdą powłokę (w tym rozszerzenie przeglądarkowe, nadpisania mostka Tauri i service worker), funkcje serwerowe i pakiety narzędzi - pod kątem zwykłych podejrzanych:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. Żadnego zewnętrznego resolvera DNS.** Kontrola SEAL w Verify nigdy nie kieruje zapytań przez dostawcę DNS-over-HTTPS - aplikacja webowa po prostu nie ma resolvera:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Usługa certyfikatów niczego nie zachowuje.** Urząd certyfikacji tożsamości nie prowadzi dziennika wydawania - ani Twojego e-maila, ani znacznika czasu, ani webhooka. Ten brak da się sprawdzić grepem:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## Egzekwowane przez testy, nie obietnice

Trzy powyższe kontrole źródła to nie jednorazowy audyt - są przypięte w zestawie testów, więc nie mogą po cichu ulec zepsuciu. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) przerywa build, jeśli:

- w przeskanowanym publikowanym kodzie źródłowym pojawi się jakikolwiek SDK analityczny lub śledzący - w aplikacji, silniku, serwerze, rozszerzeniu oraz w kodzie pakietów narzędzi,
- w tym źródle pojawi się jakikolwiek zewnętrzny resolver DNS-over-HTTPS,
- dziennik wydawania CA powróci - w kodzie źródłowym **lub** w wygenerowanym pakiecie serwera,
- polityka prywatności utraci swoje wymagane prawnie stwierdzenia (nazwany administrator, podstawa prawna, prawo do złożenia skargi).

Uruchom je samodzielnie w sklonowanym repozytorium (Node 22.18+; do tego pliku `npm install` nie jest potrzebne):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Pełny zestaw (`npm install && npm test`) uruchamia kilka tysięcy kolejnych testów, w tym testy kryptografii typu adversarial opisane w [Security & Verification](/info/security.html).

## Czego nie da się zweryfikować z zewnątrz - powiedziane wprost

Strona taka jak ta zdobywa zaufanie, nazywając własne granice:

- **Dzienniki dostępu hostingu.** Każdy serwer odpowiadający na żądanie może zalogować to żądanie - IP, ścieżkę, znacznik czasu. Nie możesz zweryfikować, co dany host zachowuje, a czego nie, i my również nie możemy, poza udokumentowanym zachowaniem naszego dostawcy. Właśnie dlatego architektura w ogóle trzyma Twoją treść poza łączem: to, co nigdy nie opuszcza Twojego urządzenia, nie może zostać przez nikogo zalogowane.
- **Że wdrożenie uruchamia właśnie ten kod.** Możesz zweryfikować, że kod źródłowy jest czysty i że wdrożone zachowanie jest z nim zgodne (powyższe kontrole obejmują oba końce), ale atestacja na poziomie binarnym wdrożenia webowego nie jest czymś, co oferuje platforma webowa. Środkami zaradczymi są publiczne repozytorium, egzekwowane testy i kontrola offline - zmanipulowane wdrożenie, które łączy się z domem, natychmiast nie przechodzi kontroli 1 i 2.
- **Hooki narzędzi domyślnie nie są objęte sandboksem.** Opcjonalna logika narzędzia działa po recenzji, we własnym realmie strony; każde narzędzie w lolly.tools jest pierwszej strony i przechodzi recenzję przed publikacją. Izolacja w Workerze jest teraz dostępna jako opcja włączana per narzędzie - narzędzie, którego manifest ustawia `isolate: true`, uruchamia swoje hooki poza wątkiem głównym - więc to, czego nie da się zweryfikować z zewnątrz, się zawęża, ale domyślna ścieżka nadal działa w realmie, a kontrolą pozostaje recenzja. Jest to stwierdzone, nie ukryte - patrz sekcja [granic projektowych](/info/security.html), która zawsze to mówiła.

## Jeśli kontrola się nie powiedzie

Rozbieżność między tą stroną a zaobserwowanym zachowaniem to raport bezpieczeństwa, i naprawdę wolelibyśmy o niej usłyszeć niż nie: [fitzy+security@suse.com](mailto:fitzy+security@suse.com), przycisk **Report a vulnerability** w dowolnym [repozytorium lolly-tools](https://github.com/lolly-tools) lub kontakt w [`/.well-known/security.txt`](/.well-known/security.txt). Skoordynowane ujawnienie i uznanie zgłaszającego to stała polityka - szczegóły w [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md).
