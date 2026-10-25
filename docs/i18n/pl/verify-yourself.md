# Zweryfikuj to sam

Każdą obietnicę z tej witryny można sprawdzić, bez konta. Większość sprawdzeń wymaga tylko przeglądarki; reszta wymaga terminala i kopii źródła. Jeśli któreś poniższe sprawdzenie nie daje pokazanego wyniku, to błąd lub złamana obietnica i chcemy o tym usłyszeć: zobacz [If a check fails](#if-a-check-fails).

Zacznij od najszybszego: upuść plik na Verify. Potem idź dalej: obserwuj sieć podczas używania narzędzia, wyciągnij wtyczkę i pracuj dalej, policz pliki cookie i przeczytaj źródło.

Te sprawdzenia obejmują samo Lolly. Jeśli Twoja organizacja prowadzi Lolly Work, dodaje ono logowanie, wspólne treści, skonfigurowaną telemetrię i zapisy audytu; sprawdź je względem [Server Surface](/info/server-surface.html) i [sekcji o organizacji w polityce prywatności](/info/privacy.html#organisation-services-with-lolly-work).

## Zobacz, jak to działa, w dziesięć sekund

Otwórz [`/verify`](/#/verify) i upuść plik na stronę. Nie ma wysyłania, konta ani czekania na serwer. Tutaj sprawdza [wygenerowaną burzę w Queensland](/info/ai-stance.html) z Our AI Stance: obraz wygenerowany przez Gemini, który Lolly otworzyło, oznaczyło i skonwertowało. Każda odznaka została wyliczona na urządzeniu, z własnych bajtów pliku.

![Verify na ekranie o szerokości telefonu - obraz burzy, zielony werdykt Made with Lolly oraz plakietki nienaruszonych poświadczeń i niezmienionych bajtów ułożone pod nim](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Werdykt to mały stos odznak, każda niezależnym faktem:

- <!--i:lock--> **Made with Lolly**: poświadczenie jest nienaruszone *i* zapisuje eksport z Lolly.
- <!--i:seal--> **The credential is intact**: podpisany manifest C2PA się parsuje, a jego własny podpis deklaracji się weryfikuje.
- <!--i:hash--> **The bytes have not changed**: skrót pliku nadal zgadza się z tym, co podpisano. Zmień jeden piksel, a ta odznaka się przestawia.
- <!--i:sparkle--> **GEN AI**: maszyna wykonała te piksele, a plik tak mówi. Lolly odczytuje tę deklarację z powrotem, zamiast ukrywać fakt.

Cała historia podróżuje z plikiem. Przetrwało tu dziewięć kroków: pięć, które Google zapisało, generując i oznaczając znakiem wodnym obraz, potem cztery, które Lolly zapisało, otwierając, oznaczając i konwertując kopię na tej stronie. Verify czyta je prosto z bajtów i rysuje jako oś czasu.

![Historia zmian, którą Verify odczytuje z powrotem z obrazu burzy - pięć kroków zapisanych przez Google, potem cztery przez Lolly, kończące się na WebP na tej stronie](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

To jest demo. Poniższe sprawdzenia to gwarancje pod spodem, a każde jest powtarzalne. [Content Credentials](/info/content-credentials-identity.html) wyjaśnia każdy werdykt.

## W przeglądarce, bez narzędzi

::: timeline
- <!--i:globe--> **1. Obserwuj sieć.** Otwórz [lolly.tools](https://lolly.tools), otwórz DevTools przeglądarki (F12), przełącz na **Network** i użyj narzędzia: wpisz adres internetowy w [QR Code](/t/qr-code), zmień kolory, wyeksportuj PNG. Każde żądanie zostaje na `lolly.tools`: powłoka aplikacji, własne pliki narzędzia i zasoby katalogu. Nie ma hosta analityki, sygnału CDN, usługi czcionek ani punktu raportowania błędów. To, co wpisujesz w narzędziu, nie pojawia się w **żadnym żądaniu**, ponieważ renderowanie jest lokalne.
- <!--i:eyeoff--> **2. Wyciągnij wtyczkę.** Wczytaj aplikację i otwórz jedno lub dwa narzędzia, potem przejdź offline (tryb samolotowy albo DevTools → Network → Offline) i przeładuj. Galeria i każde otwarte narzędzie nadal działają, w tym renderowanie i eksport w używanych formatach. Pliki narzędzia i koder formatu są zapamiętywane przy pierwszym użyciu, więc użyj narzędzia raz online, zanim przetestujesz je offline. To najmocniejsze pojedyncze sprawdzenie na tej stronie: oprogramowanie, które dzwoni do domu, nie przeżywa odcięcia kabla.
- <!--i:check--> **3. Policz pliki cookie.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Lista jest pusta: aplikacja nie ustawia plików cookie. Wklej `document.cookie` do konsoli, a dostaniesz `""`. Opcjonalna rejestracja CA ustawia krótkotrwały plik cookie `HttpOnly`, `lolly_ca_state`, ograniczony do `/api/ca`, którego `document.cookie` nie pokaże. Instancja Lolly Work używa własnych plików cookie logowania; porównaj je z [Privacy](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Przeczytaj własną pamięć.** W tym samym panelu wszystko, co Lolly przechowuje, jest przed Tobą: kilkadziesiąt zwykłych kluczy `localStorage` (motyw, język, szerokość paska bocznego, ustawienia dźwięku i widoku oraz kopia w pamięci podręcznej publicznego indeksu katalogu narzędzi) i Twoje własne dokumenty w IndexedDB. Każda wartość to czytelny ciąg lub JSON, bez niczego zaciemnionego. Wyczyszczenie danych witryny usuwa te lokalne zapisy, ale nie kopię zapasową Sync ani zapisy przechowywane przez instancję Lolly Work. **Settings → Storage → Clear all my data** robi to samo z wnętrza aplikacji, a możesz obserwować, jak magazyny i pamięci podręczne się opróżniają.
- <!--i:lock--> **5. Sprawdź, czy kontakt do zgłoszeń istnieje.** [`/.well-known/security.txt`](/.well-known/security.txt) odpowiada blokiem kontaktowym [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), a nie stroną HTML.
:::

::: details Co jeszcze możesz zobaczyć w karcie Network
Niektóre funkcje sięgają do sieci tylko wtedy, gdy ich używasz, a każda jest widoczna w tej samej karcie:

- dodanie **Google Font** w Design System Setup pobiera tę jedną rodzinę od Google, po oknie zgody, które to mówi, raz, przed pierwszym pobraniem;
- kliknięcie **ustawienia profilu druku ICC** pobiera ten profil z publicznego rejestru ICC pod color.org;
- odtwarzanie opcjonalnego wbudowanego **radia** strumieniuje ze stacji;
- wpisanie lokalizacji w **Meeting Planner** wyszukuje to miejsce w usłudze geokodowania open-meteo dla współrzędnych i strefy czasowej, raz na miasto (odpowiedzi są zapisywane na Twoim urządzeniu), a pole mówi o tym tam, gdzie piszesz;
- **URL Screenshot** ładuje wpisany adres, bo to jego zadanie, a Ty widzisz, jak to się dzieje.

Narzędzie, które deklaruje możliwość sieciową, może pobierać tylko z hostów dozwolonych w jego manifeście, a ta kontrola kończy się niepowodzeniem bez przepuszczania ruchu. Żadne dostarczane dziś narzędzie jej nie deklaruje, więc to egzekwowana przez przeglądarkę Content-Security-Policy trzyma powyższą listę przy jej hostach. [Polityka prywatności](/info/privacy.html) zawiera kanoniczną tabelę wszystkich z nich, w tym ruch instancji zarządzanej, taki jak odświeżanie polityk i włączone raportowanie.
:::

## Z terminala

**6. Punkt renderowania odpowiada tylko danymi publicznymi.** Jedna funkcja serwerowa, która umieszcza wpisane dane w URL, czyli renderowanie hot-link, działa tutaj. [Polityka prywatności](/info/privacy.html) mówi, co to oznacza dla danych, które umieszczasz w linku.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Każde wdrożenie wybiera (`LOLLY_DISABLE_RENDER_GET=1`): w instancji, która to ustawia, ta sama próba zwraca `404`. Ta różnica to działanie ustawienia, a nie niespójność.

**7. Sprawdź usługi, które włącza Twoje wdrożenie.** [Server Surface](/info/server-surface.html) wymienia opcjonalne usługi i linkuje ich szczegółowe opisy. Dla Lolly Work uwzględnij jego uwierzytelniane API, połączenie współpracy, magazyn i skonfigurowanych dostawców. Próba publicznego lolly.tools nie testuje prywatnej instancji organizacji.

Jeśli prowadzisz własną instancję, [Delivery deployment](/info/deploy-delivery.html) zawiera dla niej kontrole wydania: integralność modeli, próbę krawędzi i jej listę próbek, wersje wyświetlania, prywatną bramę pobierania i podpisany katalog w przeglądarce.


## W kodzie źródłowym

Wszystko powyższe wciąż mogłoby być teatrem, gdyby wdrożony kod różnił się od kodu publicznego. Sprawdź więc kod. Wdrożenie buduje się z [publicznego repozytorium](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Żadnego trackera ani SDK analityki, nigdzie.** Przeszukaj kod, który jest dostarczany (silnik, każdą powłokę, w tym rozszerzenie przeglądarki, nadpisania mostu Tauri i service worker, funkcje serwerowe i paczki narzędzi), pod kątem zwykłych podejrzanych:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

To skanowanie szuka zewnętrznych SDK śledzących. Nie wykazuje braku własnego raportowania użycia: Lolly Work obsługuje telemetrię organizacji i osobny dziennik audytu, z własną polityką i testami.

**9. Żadnego zewnętrznego resolvera DNS.** Sprawdzenie SEAL w Verify nigdy nie wysyła zapytania przez dostawcę DNS-over-HTTPS, ponieważ aplikacja nie ma resolvera:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Usługa certyfikatów nie prowadzi dziennika wydawania.** Tożsamościowe CA nie prowadzi dziennika tego, co wydało, ani spisu tożsamości: żadnej linii stdout, webhooka ani magazynu certyfikatów. Nieobecności można szukać:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

CA przechowuje krótkotrwały stan roboczy: kubełki ograniczania żądań trzymają zahaszowane klucze IP i e-mail przez swoje okno, a magazyn dopuszczeń wdrożenia zarządzanego trzyma kluczowany identyfikator i skrót żądania najwyżej przez dziesięć minut. [Content Credentials engineering](/info/content-credentials-engineering.html#protocol) podaje szczegóły.

## Egzekwowane przez testy

Powyższe sprawdzenia źródła nie są jednorazowym audytem: są przypięte w zestawie testów, więc nie mogą po cichu zgnić. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) sprawdza dłuższą listę nazw trackerów niż powyższe skanowanie i psuje build, jeśli:

- jakikolwiek SDK analityki lub śledzenia pojawia się gdziekolwiek w dostarczanym źródle, które skanuje, w kodzie aplikacji, silnika, serwera, rozszerzenia i paczek narzędzi;
- jakikolwiek zewnętrzny resolver DNS-over-HTTPS pojawia się w tym źródle;
- dziennik wydawania CA wraca, w źródle **lub** wygenerowanym pakiecie serwera;
- polityka prywatności traci swoje wymagane prawem oświadczenia (nazwany administrator, podstawa prawna, prawo do skargi).

Uruchom je sam w klonie (Node 22.18 lub nowszy; ten plik nie wymaga `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Pełny zestaw testów (`pnpm install && pnpm test`) uruchamia kilka tysięcy kolejnych, w tym testy kryptograficzne o charakterze adwersarialnym opisane w [Bezpieczeństwo i weryfikacja](/info/security.html).

## Czego nie możesz zweryfikować z zewnątrz

- **Dzienniki dostępu hostingu.** Każdy serwer, który odpowiada na żądanie, może je zapisać: adres IP, ścieżkę i czas. Zewnętrzna próba nie może ustalić, jak długo dzienniki są przechowywane. Operator kontroluje logowanie, rotację i eksporty i musi ujawnić te wybory. Lokalne renderowanie zostawia zwykłe edycje na Twoim urządzeniu; opcjonalne renderowanie serwerowe i usługi wspólnej przestrzeni roboczej mają osobne przepływy danych opisane w polityce prywatności.
- **Że wdrożenie uruchamia ten kod.** Możesz sprawdzić, że źródło jest czyste i że wdrożone zachowanie mu odpowiada, i robią to powyższe sprawdzenia. Atestacja na poziomie binarnym wdrożenia webowego nie jest czymś, co oferuje platforma webowa. Środki zaradcze to publiczne repozytorium, egzekwowane testy i sprawdzenie offline: zmanipulowane wdrożenie, które dzwoni do domu, od razu oblewa sprawdzenia 1 i 2.
- **Hooki narzędzi.** Opcjonalna logika wbudowanego narzędzia jest przeglądana, a nie izolowana w piaskownicy: działa na stronie, chyba że narzędzie zdecyduje się na Worker. Każde narzędzie na lolly.tools jest własne i przeglądane, zanim zostanie dostarczone. [Threat Model](/info/threat-model.html#trust-boundaries) opisuje, gdzie hooki działają i co je ogranicza.

## Jeśli kontrola się nie powiedzie

Różnica między tą stroną a tym, co obserwujesz, jest zgłoszeniem bezpieczeństwa. Wyślij ją prywatnymi kanałami na [Security & Verification](/info/security.html#reporting-a-vulnerability). Stosujemy skoordynowane ujawnianie i wymieniamy zgłaszających.
