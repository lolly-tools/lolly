# Lolly i Adobe

_Ostatnio sprawdzono: 28 września 2026._

Lolly obsługuje edycję i konwersję obrazów, układ, powtarzalną produkcję materiałów marki, wyjście do druku oraz Content Credentials. [lolly.work](https://lolly.work) dodaje do tego twórczego przepływu pracy tożsamość organizacji, współdzielone zasoby, zatwierdzanie i automatyczną produkcję po stronie serwera.

## Gdzie się pokrywają

Oba obsługują takie zadania jak zmiana rozmiaru obrazów, komponowanie układów i eksport do profesjonalnych formatów. Lolly obsługuje PDF/X, CMYK oraz wyjście rastrowe o dużej głębi bitowej, z [możliwościami zależnymi od formatu](/info/formats.html). Jego narzędzia działające na urządzeniu konwertują i czyszczą pliki bez ich przesyłania.

Wyspecjalizowane aplikacje Adobe obejmują rozbudowane przepływy pracy twórczej. [Photoshop](https://www.adobe.com/products/photoshop.html) zapewnia na przykład zaawansowane narzędzia do edycji zdjęć, zaznaczania, maskowania i kompozycji. Porównaj operacje edycji, których wymaga Twoja praca, z narzędziami Lolly; powtarzalny zasób marki i złożona retusz mogą mieć różne wymagania.

## Tworzenie i usługi organizacyjne

Samodzielne Lolly działa bez konta Adobe i bez konta Lolly, z tym samym silnikiem w przeglądarce, aplikacji desktopowej i CLI. Szablony i tokeny projektowe sprawiają, że wyniki są powtarzalne, a [Udostępnianie z regułami](/info/create-a-tool.html) zamienia projekt w narzędzie, które mogą wypełniać inne osoby.

lolly.work to osobna usługa w ramach projektu Lolly, open source na licencji MPL-2.0 tak jak aplikacje twórcze. Zapewnia SSO, SCIM, współdzielone katalogi i projekty, zatwierdzanie, zasady dostępu, rejestry audytu i renderowanie po stronie serwera. Organizacja może samodzielnie uruchomić obie części i podłączyć istniejące biblioteki zasobów. Lokalne tworzenie pozostaje na urządzeniu; praca współdzielona i zadania serwerowe korzystają ze skonfigurowanych usług.

## Content Credentials i tożsamość

Lolly może podpisywać obsługiwane eksporty na urządzeniu, z Content Credentials włączonymi przez użytkownika. Klucz wygenerowany na urządzeniu dowodzi integralności podpisu pliku; weryfikator nadal musi zaufać podpisującemu, zanim zaprezentuje zweryfikowaną tożsamość. Organizacja może używać własnego urzędu certyfikacji i rozpowszechniać jego certyfikat główny wśród swoich weryfikatorów. lolly.work obsługuje też podpisywanie po stronie serwera przy użyciu skonfigurowanego certyfikatu i klucza organizacji.

Dzięki temu w rozwiązaniu Lolly dostępne jest zarówno podpisywanie osobiste, jak i organizacyjne. Zobacz [Content Credentials Identity](/info/content-credentials-identity.html), [przewodnik po podpisywaniu w lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/c2pa.md) oraz [przegląd rozwiązania łączonego](/info/compare.html). Narzędzia transformacji działające na urządzeniu nie dodają znaków wodnych Lolly ani metadanych pochodzenia.

Adobe, Photoshop i Creative Cloud są znakami towarowymi firmy Adobe. Ta strona opisuje, gdzie rozwiązania się pokrywają, i nie jest powiązana z firmą Adobe.
