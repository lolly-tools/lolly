# Sprawdź samodzielnie

Każdą obietnicę na tej stronie można sprawdzić bez konta. Większość testów wymaga tylko przeglądarki; reszta wymaga terminala i kopii kodu źródłowego. Jeśli któryś z poniższych testów nie daje pokazanego wyniku, to błąd lub niedotrzymana obietnica i chcemy o tym wiedzieć: zobacz [Jeśli test się nie powiedzie](#if-a-check-fails).

Te testy dotyczą samego Lolly. Jeśli Twoja organizacja prowadzi Lolly Work, dochodzą logowanie, wspólne treści, skonfigurowana telemetria i zapisy audytu; sprawdź je według [Powierzchni serwera](/info/server-surface.html) i [sekcji polityki prywatności dotyczącej organizacji](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-clock-->
## Zobacz, jak działa, w dziesięć sekund

Otwórz [`/verify`](/#/verify) i upuść plik na stronę. Nie ma przesyłania, konta ani czekania na serwer. Tutaj sprawdza [wygenerowaną burzę w Queensland](/info/ai-stance.html) z Naszego stanowiska wobec AI: obraz wygenerowany przez Gemini, który Lolly otworzyło, oznaczyło i przekonwertowało. Każda odznaka została ustalona na urządzeniu, na podstawie bajtów samego pliku.

![Lolly Verify na ekranie o szerokości telefonu - obraz burzy, zielony werdykt Made with Lolly, a pod nim odznaki nienaruszonego poświadczenia i niezmienionych bajtów](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Werdykt to niewielki zestaw odznak, z których każda jest niezależnym faktem:

- <!--i:lock--> **Made with Lolly**: poświadczenie jest nienaruszone *i* odnotowuje eksport z Lolly.
- <!--i:seal--> **The credential is intact**: podpisany manifest C2PA daje się sparsować, a podpis jego własnej deklaracji przechodzi weryfikację.
- <!--i:hash--> **The bytes have not changed**: skrót pliku nadal odpowiada temu, co podpisano. Zmień jeden piksel, a ta odznaka się zmieni.
- <!--i:sparkle--> **GEN AI**: te piksele stworzyła maszyna i plik o tym mówi. Lolly odczytuje tę deklarację zamiast ukrywać ten fakt.

Cała historia podróżuje z plikiem. Tutaj zachowało się dziewięć kroków: pięć zarejestrowanych przez Google podczas generowania obrazu i dodawania znaku wodnego, a potem cztery zarejestrowane przez Lolly podczas otwierania, oznaczania i konwersji kopii na tej stronie. Lolly Verify odczytuje je bezpośrednio z bajtów i rysuje jako oś czasu.

![Historia zmian, którą Lolly Verify odczytuje z obrazu burzy - pięć kroków zapisanych przez Google, potem cztery przez Lolly, zakończone plikiem WebP na tej stronie](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Poniższe testy sprawdzają gwarancje stojące za tym pokazem, a każdy z nich można powtórzyć. [Content Credentials](/info/content-credentials-identity.html) wyjaśnia każdy werdykt.

<!--i:eti-globe-->
## W przeglądarce, bez dodatkowych narzędzi

::: timeline
- <!--i:globe--> **1. Obserwuj sieć.** Otwórz [lolly.tools](https://lolly.tools), otwórz DevTools przeglądarki (F12), przejdź do **Network** i użyj narzędzia: wpisz adres internetowy w [Lolly QR Code](/t/qr-code), zmień kolory, wyeksportuj PNG. Każde żądanie trafia do `lolly.tools`: powłoka aplikacji, własne pliki narzędzia i zasoby katalogu. Nie ma hosta analitycznego, sygnałów śledzących CDN, usługi czcionek ani punktu końcowego raportowania błędów. To, co wpisujesz w narzędziu, nie pojawia się **w żadnym żądaniu**, ponieważ renderowanie jest lokalne.
- <!--i:eyeoff--> **2. Odłącz sieć.** Wczytaj aplikację i otwórz jedno lub dwa narzędzia, potem przejdź offline (tryb samolotowy lub DevTools → Network → Offline) i przeładuj. Galeria i każde otwarte wcześniej narzędzie nadal działają, w tym renderowanie i eksport w użytych formatach. Pliki narzędzia i koder formatu trafiają do pamięci podręcznej przy pierwszym użyciu, więc użyj narzędzia raz online przed testem offline. To najmocniejszy pojedynczy test na tej stronie: oprogramowanie wysyłające dane do swojego serwera nie przetrwa odłączenia kabla.
- <!--i:check--> **3. Policz pliki cookie.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Lista jest pusta: aplikacja nie ustawia plików cookie. Wklej `document.cookie` do konsoli, a otrzymasz `""`. Opcjonalna rejestracja w CA ustawia krótkotrwały plik cookie `HttpOnly`, `lolly_ca_state`, ograniczony do `/api/ca`, którego `document.cookie` nie może pokazać. Instancja Lolly Work używa własnych plików cookie logowania; porównaj je z [Prywatnością](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Odczytaj własne dane.** W tym samym panelu widzisz wszystko, co przechowuje Lolly: kilkadziesiąt zwykłych kluczy `localStorage` (motyw, język, szerokość paska bocznego, ustawienia dźwięku i widoku oraz kopia indeksu publicznego katalogu narzędzi w pamięci podręcznej) i własne dokumenty w IndexedDB. Każda wartość jest czytelnym ciągiem znaków lub JSON, bez żadnego zaciemniania. Wyczyszczenie danych witryny usuwa te lokalne rekordy, ale nie kopię zapasową Sync ani rekordy przechowywane przez instancję Lolly Work. **Settings → Storage → Clear all my data** robi to samo z poziomu aplikacji i możesz obserwować opróżnianie magazynów i pamięci podręcznych.
- <!--i:lock--> **5. Sprawdź, czy istnieje kontakt do zgłaszania podatności.** [`/.well-known/security.txt`](/.well-known/security.txt) odpowiada blokiem kontaktowym [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), a nie stroną HTML.
:::

::: details Co jeszcze możesz zobaczyć na karcie Network
Niektóre funkcje łączą się z siecią tylko wtedy, gdy ich używasz, a każda jest widoczna na tej samej karcie:

- dodanie **Google Font** w Lolly Design System Setup pobiera tę jedną rodzinę z Google, po oknie zgody, które o tym informuje i pojawia się raz, przed pierwszym pobraniem;
- kliknięcie **gotowego profilu drukarskiego ICC** pobiera ten profil z publicznego rejestru ICC pod color.org;
- odtwarzanie opcjonalnego wbudowanego **radia** strumieniuje dźwięk ze stacji;
- wpisanie lokalizacji w **Meeting Planner** wyszukuje to miejsce w usłudze geokodowania open-meteo, aby poznać współrzędne i strefę czasową, raz na miasto (odpowiedzi są zapisywane na Twoim urządzeniu), a pole informuje o tym w miejscu wpisywania;
- **Lolly URL Screenshot** wczytuje wpisany adres i możesz to obserwować.

Narzędzie deklarujące dostęp do sieci może pobierać tylko z hostów dozwolonych w jego manifeście, a przy niepowodzeniu tej kontroli dostęp jest blokowany. Żadne obecnie dostarczane narzędzie nie deklaruje takiego dostępu, więc egzekwowana przez przeglądarkę Content-Security-Policy ogranicza powyższą listę do swoich hostów. [Polityka prywatności](/info/privacy.html) zawiera wiążącą tabelę wszystkich tych połączeń, w tym ruchu instancji zarządzanych, takiego jak odświeżanie polityk i włączone raportowanie.
:::

<!--i:eti-code-->
## Z terminala

**6. Punkt końcowy renderowania odpowiada wyłącznie danymi publicznymi.** Jedyna funkcja serwera, która umieszcza wpisane dane wejściowe w adresie URL, czyli renderowanie przez bezpośredni link, jest tu aktywna. [Polityka prywatności](/info/privacy.html) mówi, co to oznacza dla danych wejściowych umieszczanych w linku.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Każde wdrożenie wybiera (`LOLLY_DISABLE_RENDER_GET=1`): w instancji z ustawioną tą zmienną ten sam test zwraca `404`. Ta różnica oznacza działające ustawienie, a nie niespójność.

**7. Sprawdź usługi włączone w Twoim wdrożeniu.** [Powierzchnia serwera](/info/server-surface.html) wymienia opcjonalne usługi i zawiera linki do ich szczegółowej dokumentacji. Dla Lolly Work uwzględnij uwierzytelnione API, połączenie współpracy, przechowywanie danych i skonfigurowanych dostawców. Test publicznego lolly.tools nie sprawdza prywatnej instancji organizacji.

Jeśli prowadzisz własną instancję, [Wdrażanie dostarczania](/info/deploy-delivery.html) zawiera testy wydania: integralność modelu, test warstwy brzegowej i jego listę próbek, wersje do wyświetlania, prywatną bramę pobierania i podpisany katalog w przeglądarce.


<!--i:eti-search-->
## W kodzie źródłowym

Wszystko powyżej nadal mogłoby być pozorem, gdyby wdrożony kod różnił się od kodu publicznego. Sprawdź więc kod. Wdrożenie jest budowane z [publicznego repozytorium](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Żadnych mechanizmów śledzących ani SDK analitycznych, nigdzie.** Przeszukaj dostarczany kod (silnik, każdą powłokę, w tym rozszerzenie przeglądarki, nadpisania mostu Tauri i service worker, funkcje serwerowe i pakiety narzędzi) pod kątem typowych podejrzanych:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

To skanowanie szuka SDK śledzących firm trzecich. Nie dowodzi braku własnego raportowania użycia: Lolly Work obsługuje telemetrię organizacji i osobny dziennik audytu, z własnymi politykami i testami.

**9. Brak zewnętrznego resolvera DNS.** Sprawdzanie SEAL w Lolly Verify nigdy nie wysyła zapytania przez dostawcę DNS-over-HTTPS, ponieważ aplikacja nie ma resolvera:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Usługa certyfikatów nie prowadzi dziennika wystawiania.** CA tożsamości nie prowadzi dziennika wystawionych certyfikatów ani spisu tożsamości: ani wiersza na stdout, ani webhooka, ani magazynu certyfikatów. Ten brak można sprawdzić wyszukiwaniem:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA przechowuje krótkotrwały stan roboczy: koszyki ograniczania liczby żądań przechowują skróty kluczy IP i e-mail przez swoje okno czasowe, a magazyn dopuszczeń zarządzanego wdrożenia przechowuje identyfikator wyliczony z kluczem i skrót żądania przez najwyżej dziesięć minut. [Inżynieria Content Credentials](/info/content-credentials-engineering.html#protocol) opisuje szczegóły.

<!--i:eti-flask-->
## Egzekwowane przez testy

Powyższe kontrole kodu źródłowego nie są jednorazowym audytem: są utrwalone w zestawie testów, więc nie mogą po cichu się zdezaktualizować. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) sprawdza dłuższą listę nazw mechanizmów śledzących niż powyższe skanowanie i przerywa kompilację błędem, jeśli:

- jakikolwiek SDK analityczny lub śledzący pojawi się gdziekolwiek w skanowanym kodzie dostarczanym użytkownikom: aplikacji, silniku, serwerze, rozszerzeniu i pakietach narzędzi;
- w tym kodzie pojawi się jakikolwiek resolver DNS-over-HTTPS firmy trzeciej;
- powróci dziennik wystawiania CA, w kodzie źródłowym **lub** wygenerowanym pakiecie serwera;
- polityka prywatności utraci wymagane prawem zapisy (wskazany administrator, podstawa prawna, prawo do skargi).

Uruchom je samodzielnie w sklonowanym repozytorium (Node 22.18 lub nowszy; ten plik nie wymaga `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Pełny zestaw (`pnpm install && pnpm test`) uruchamia jeszcze kilka tysięcy testów, w tym testy kryptografii symulujące ataki opisane w [Bezpieczeństwie i weryfikacji](/info/security.html).

<!--i:eti-eye-off-->
## Czego nie możesz sprawdzić z zewnątrz

- **Logi dostępu hostingu.** Każdy serwer może rejestrować żądania, na które odpowiada: adres IP, ścieżkę i czas. Test z zewnątrz nie może ustalić, jak długo przechowywane są logi. Operator kontroluje rejestrowanie, rotację i eksporty i musi ujawnić te decyzje. Lokalne renderowanie zatrzymuje zwykłe zmiany na Twoim urządzeniu; opcjonalne renderowanie serwerowe i usługi wspólnego obszaru roboczego mają osobne przepływy danych opisane w polityce prywatności.
- **Czy wdrożenie uruchamia ten kod.** Możesz sprawdzić, że kod źródłowy jest czysty i że zachowanie wdrożenia odpowiada kodowi, a powyższe testy sprawdzają obie rzeczy. Platforma internetowa nie oferuje poświadczenia wdrożenia internetowego na poziomie plików binarnych. Środki ograniczające ryzyko to publiczne repozytorium, obowiązkowe testy i sprawdzenie offline: zmodyfikowane wdrożenie, które wysyła dane do swojego serwera, od razu oblewa testy 1 i 2.
- **Hooki narzędzi.** Opcjonalna logika wbudowanego narzędzia jest poddawana przeglądowi zamiast izolacji: działa na stronie, chyba że narzędzie wybierze Worker. Każde narzędzie na lolly.tools pochodzi od twórców Lolly i przechodzi przegląd przed wydaniem. [Model zagrożeń](/info/threat-model.html#trust-boundaries) określa, gdzie działają hooki i co je ogranicza.

<!--i:eti-warning-->
## Jeśli test się nie powiedzie

Różnica między tą stroną a tym, co obserwujesz, jest podstawą zgłoszenia bezpieczeństwa. Wyślij je prywatnymi kanałami podanymi w [Bezpieczeństwie i weryfikacji](/info/security.html#reporting-a-vulnerability). Stosujemy skoordynowane ujawnianie podatności i wymieniamy osoby zgłaszające.
