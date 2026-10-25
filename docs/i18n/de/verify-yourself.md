# Überprüfen Sie es selbst

Jedes Versprechen auf dieser Website lässt sich prüfen, ohne Konto. Die meisten Prüfungen brauchen nur einen Browser; der Rest braucht ein Terminal und eine Kopie des Quellcodes. Wenn eine Prüfung unten nicht das gezeigte Ergebnis liefert, ist das ein Fehler oder ein gebrochenes Versprechen, und wir wollen davon hören: siehe [Wenn eine Prüfung fehlschlägt](#if-a-check-fails).

Beginnen Sie mit der schnellsten: Legen Sie eine Datei auf Verify ab. Gehen Sie dann weiter: Beobachten Sie das Netzwerk, während Sie ein Tool nutzen, ziehen Sie den Stecker und arbeiten Sie weiter, zählen Sie die Cookies und lesen Sie den Quellcode.

Diese Prüfungen betreffen Lolly allein. Wenn Ihre Organisation Lolly Work betreibt, ergänzt es Anmeldung, gemeinsame Inhalte, konfigurierte Telemetrie und Audit-Aufzeichnungen; prüfen Sie diese gegen [Server-Oberfläche](/info/server-surface.html) und den [Organisationsabschnitt der Datenschutzrichtlinie](/info/privacy.html#organisation-services-with-lolly-work).

## In zehn Sekunden sehen, dass es funktioniert

Öffnen Sie [`/verify`](/#/verify) und legen Sie eine Datei auf der Seite ab. Es gibt keinen Upload, kein Konto und kein Warten auf einen Server. Hier prüft es den [erzeugten Sturm in Queensland](/info/ai-stance.html) aus Our AI Stance: ein Bild, das Gemini erzeugt und Lolly geöffnet, markiert und umgewandelt hat. Jedes Badge wurde auf dem Gerät berechnet, aus den eigenen Bytes der Datei.

![Verify auf einem Bildschirm in Telefonbreite - das Sturmbild, ein grünes Made-with-Lolly-Urteil und darunter die Abzeichen für intakte Zertifizierung und unveränderte Bytes](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Das Urteil ist ein kleiner Stapel von Badges, jedes ein unabhängiger Fakt:

- <!--i:lock--> **Made with Lolly**: Das Credential ist intakt *und* hält einen Lolly-Export fest.
- <!--i:seal--> **The credential is intact**: Das signierte C2PA-Manifest lässt sich parsen, und seine eigene Aussagesignatur verifiziert.
- <!--i:hash--> **The bytes have not changed**: Der Hash der Datei stimmt noch mit dem überein, was signiert wurde. Ändern Sie ein Pixel, und dieses Badge kippt.
- <!--i:sparkle--> **GEN AI**: Eine Maschine hat diese Pixel erzeugt, und die Datei sagt das. Lolly liest diese Erklärung zurück, statt die Tatsache zu verbergen.

Der ganze Verlauf reist mit der Datei. Neun Schritte überleben hier: fünf, die Google beim Erzeugen und Kennzeichnen des Bildes festgehalten hat, dann vier, die Lolly beim Öffnen, Markieren und Umwandeln der Kopie auf dieser Seite festgehalten hat. Verify liest sie direkt aus den Bytes und zeichnet sie als Zeitleiste.

![Die Änderungshistorie, die Verify aus dem Sturmbild ausliest - fünf Schritte von Google aufgezeichnet, dann vier von Lolly, endend im WebP auf dieser Seite](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Das ist die Demo. Die Prüfungen unten sind die Garantien darunter, und jede ist reproduzierbar. [Content Credentials](/info/content-credentials-identity.html) erklärt jedes Urteil.

## In Ihrem Browser, ohne Werkzeuge

::: timeline
- <!--i:globe--> **1. Das Netzwerk beobachten.** Öffnen Sie [lolly.tools](https://lolly.tools), öffnen Sie die DevTools Ihres Browsers (F12), wechseln Sie zu **Network** und nutzen Sie ein Tool: Tippen Sie eine Webadresse in [QR Code](/t/qr-code), ändern Sie Farben, exportieren Sie ein PNG. Jede Anfrage bleibt bei `lolly.tools`: die App-Shell, die eigenen Dateien des Tools und Katalog-Assets. Es gibt keinen Analytics-Host, kein CDN-Beacon, keinen Schriftdienst und keinen Endpunkt für Fehlerberichte. Was Sie in ein Tool tippen, erscheint in **gar keiner Anfrage**, weil das Rendern lokal ist.
- <!--i:eyeoff--> **2. Den Stecker ziehen.** Laden Sie die App und öffnen Sie ein oder zwei Tools, gehen Sie dann offline (Flugmodus oder DevTools → Network → Offline) und laden Sie neu. Die Galerie und jedes Tool, das Sie geöffnet haben, funktionieren weiter, einschließlich Rendern und Export in den Formaten, die Sie genutzt haben. Die Dateien eines Tools und der Encoder eines Formats werden beim ersten Gebrauch zwischengespeichert; nutzen Sie ein Tool also einmal online, bevor Sie es offline testen. Das ist die stärkste einzelne Prüfung auf dieser Seite: Software, die nach Hause telefoniert, übersteht es nicht, wenn man ihr die Leine kappt.
- <!--i:check--> **3. Die Cookies zählen.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Die Liste ist leer: Die App setzt keine Cookies. Fügen Sie `document.cookie` in die Konsole ein, und Sie erhalten `""`. Die optionale CA-Registrierung setzt ein kurzlebiges `HttpOnly`-Cookie, `lolly_ca_state`, auf `/api/ca` begrenzt, das `document.cookie` nicht zeigen kann. Eine Lolly-Work-Instanz nutzt eigene Anmelde-Cookies; vergleichen Sie sie mit [Datenschutz](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Ihren eigenen Speicher lesen.** Im selben Panel liegt alles, was Lolly behält, vor Ihnen: ein paar Dutzend einfache `localStorage`-Schlüssel (Design, Sprache, Seitenleistenbreite, Klang- und Ansichtseinstellungen und eine zwischengespeicherte Kopie des öffentlichen Tool-Katalogindex) und Ihre eigenen Dokumente in IndexedDB. Jeder Wert ist ein lesbarer String oder JSON, nichts ist verschleiert. Das Löschen der Websitedaten entfernt diese lokalen Aufzeichnungen, nicht aber ein Sync-Backup oder Aufzeichnungen einer Lolly-Work-Instanz. **Settings → Storage → Clear all my data** tut dasselbe aus der App heraus, und Sie können zusehen, wie sich Speicher und Caches leeren.
- <!--i:lock--> **5. Prüfen, ob der Kontakt für Meldungen existiert.** [`/.well-known/security.txt`](/.well-known/security.txt) antwortet mit einem Kontaktblock nach [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), nicht mit einer HTML-Seite.
:::

::: details Was Sie sonst im Tab Network sehen können
Manche Funktionen erreichen das Netzwerk nur, wenn Sie sie nutzen, und jede ist im selben Tab sichtbar:

- Das Hinzufügen einer **Google Font** in Design System Setup holt diese eine Familie von Google, nach einem Einwilligungsdialog, der das sagt, einmal, vor dem ersten Abruf;
- ein Klick auf eine **ICC-Druckprofil-Voreinstellung** holt dieses Profil aus dem öffentlichen Register des ICC bei color.org;
- das Abspielen des optionalen eingebauten **Radios** streamt vom Sender;
- die Eingabe eines Ortes im **Meeting Planner** schlägt diesen Ort einmal pro Stadt im Geocoding-Dienst von open-meteo nach, für Koordinaten und Zeitzone (Antworten werden auf Ihrem Gerät gespeichert), und das Feld sagt das dort, wo Sie tippen;
- **URL Screenshot** lädt die Adresse, die Sie getippt haben, weil das seine Aufgabe ist, und Sie sehen es geschehen.

Ein Tool, das eine Netzwerk-Capability deklariert, darf nur von den Hosts abrufen, die sein Manifest zulässt, und diese Prüfung schlägt geschlossen fehl. Kein heute ausgeliefertes Tool deklariert eine, sodass die vom Browser durchgesetzte Content-Security-Policy die obige Liste auf ihre Hosts begrenzt. Die [Datenschutzrichtlinie](/info/privacy.html) führt die kanonische Tabelle von all dem, einschließlich Datenverkehr verwalteter Instanzen wie Richtlinienaktualisierungen und aktivierter Berichte.
:::

## Vom Terminal aus

**6. Der Render-Endpunkt antwortet nur mit öffentlichen Daten.** Die eine Serverfunktion, die getippte Eingaben in eine URL legt, Hot-Link-Renderings, ist hier live. Die [Datenschutzrichtlinie](/info/privacy.html) sagt, was das für die Eingaben bedeutet, die Sie in einen Link legen.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Jede Bereitstellung wählt selbst (`LOLLY_DISABLE_RENDER_GET=1`): Auf einer Instanz, die es setzt, liefert dieselbe Sonde `404`. Dieser Unterschied ist die Einstellung bei der Arbeit, keine Inkonsistenz.

**7. Die Dienste prüfen, die Ihre Bereitstellung aktiviert.** [Server-Oberfläche](/info/server-surface.html) listet die optionalen Dienste auf und verlinkt ihre detaillierten Referenzen. Beziehen Sie bei Lolly Work seine authentifizierten APIs, die Collaboration-Verbindung, den Speicher und die konfigurierten Anbieter ein. Eine Sonde des öffentlichen lolly.tools testet keine private Organisationsinstanz.

Wenn Sie eine eigene Instanz betreiben, enthält [Auslieferungs-Bereitstellung](/info/deploy-delivery.html) die Release-Prüfungen dafür: Modellintegrität, die Edge-Sonde und ihre Beispielliste, Anzeigeversionen, das private Download-Gateway und der signierte Katalog in einem Browser.


## Im Quellcode

All das könnte noch Theater sein, wenn der bereitgestellte Code vom öffentlichen Code abwiche. Prüfen Sie also den Code. Die Bereitstellung wird aus [dem öffentlichen Repository](https://github.com/lolly-tools/lolly) gebaut:

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Kein Tracker und kein Analytics-SDK, nirgends.** Durchsuchen Sie den Code, der ausgeliefert wird (die Engine, jede Shell einschließlich der Browser-Erweiterung, die Tauri-Bridge-Überschreibungen und den Service Worker, die Serverfunktionen und die Tool-Pakete), nach den üblichen Verdächtigen:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Diese Suche sieht nach SDKs von Drittanbietern zum Tracking. Sie zeigt nicht die Abwesenheit von Nutzungsberichten aus eigener Hand: Lolly Work unterstützt Organisations-Telemetrie und ein getrenntes Audit-Protokoll, mit eigener Richtlinie und eigenen Tests.

**9. Kein DNS-Resolver eines Drittanbieters.** Die SEAL-Prüfung von Verify sendet nie eine Abfrage über einen DNS-over-HTTPS-Anbieter, weil die App keinen Resolver hat:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Der Zertifikatsdienst führt kein Ausstellungsprotokoll.** Die Identitäts-CA führt kein Protokoll dessen, was sie ausgestellt hat, und kein Verzeichnis von Identitäten: keine stdout-Zeile, keinen Webhook, keinen Zertifikatsspeicher. Die Abwesenheit lässt sich suchen:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

Die CA führt kurzlebigen Arbeitszustand: Ratenbegrenzungs-Buckets halten gehashte IP- und E-Mail-Schlüssel für ihr Fenster, und der Zulassungsspeicher einer verwalteten Bereitstellung hält höchstens zehn Minuten eine verschlüsselte Kennung und einen Anfrage-Digest. [Engineering der Content Credentials](/info/content-credentials-engineering.html#protocol) hat die Einzelheiten.

## Durch Tests erzwungen

Die Quellprüfungen oben sind kein einmaliges Audit: Sie sind in der Testsuite festgeschrieben und können daher nicht unbemerkt verrotten. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) prüft eine längere Liste von Tracker-Namen als die Suche oben und lässt den Build fehlschlagen, wenn:

- irgendein Analytics- oder Tracking-SDK irgendwo im ausgelieferten Quellcode auftaucht, den es durchsucht, quer durch App-, Engine-, Server-, Erweiterungs- und Tool-Paket-Code;
- irgendein DNS-over-HTTPS-Resolver eines Drittanbieters in diesem Quellcode auftaucht;
- das Ausstellungsprotokoll der CA zurückkehrt, im Quellcode **oder** im erzeugten Server-Bundle;
- die Datenschutzrichtlinie ihre gesetzlich geforderten Aussagen verliert (benannter Verantwortlicher, Rechtsgrundlage, Beschwerderecht).

Führen Sie sie selbst im Clone aus (Node 22.18 oder neuer; diese Datei braucht kein `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Die vollständige Suite (`pnpm install && pnpm test`) führt mehrere Tausend weitere aus, einschließlich der adversariellen Kryptografietests, die unter [Security & Verification](/info/security.html) beschrieben sind.

## Was Sie von außen nicht prüfen können

- **Hosting-Zugriffsprotokolle.** Jeder Server, der eine Anfrage beantwortet, kann sie protokollieren: IP-Adresse, Pfad und Zeit. Eine Sonde von außen kann nicht feststellen, wie lange Protokolle aufbewahrt werden. Der Betreiber steuert Protokollierung, Rotation und Exporte und muss diese Entscheidungen offenlegen. Lokales Rendern hält gewöhnliche Bearbeitungen auf Ihrem Gerät; optionales Server-Rendering und gemeinsame Workspace-Dienste haben die getrennten Datenflüsse, die die Datenschutzrichtlinie beschreibt.
- **Dass die Bereitstellung diesen Code ausführt.** Sie können prüfen, dass der Quellcode sauber ist und dass das bereitgestellte Verhalten ihm entspricht, und die Prüfungen oben tun beides. Eine Attestierung auf Binärebene für eine Web-Bereitstellung bietet die Webplattform nicht. Die Gegenmaßnahmen sind das öffentliche Repository, die erzwungenen Tests und die Offline-Prüfung: Eine manipulierte Bereitstellung, die nach Hause telefoniert, fällt bei den Prüfungen 1 und 2 sofort durch.
- **Tool-Hooks.** Die optionale Logik eines eingebauten Tools wird geprüft statt in eine Sandbox gesteckt: Sie läuft in der Seite, sofern das Tool nicht einen Worker wählt. Jedes Tool auf lolly.tools stammt aus erster Hand und wird vor der Auslieferung geprüft. Das [Bedrohungsmodell](/info/threat-model.html#trust-boundaries) legt dar, wo Hooks laufen und was sie begrenzt.

## Wenn eine Prüfung fehlschlägt

Eine Abweichung zwischen dieser Seite und dem, was Sie beobachten, ist eine Sicherheitsmeldung. Senden Sie sie über die privaten Kanäle unter [Sicherheit und Verifizierung](/info/security.html#reporting-a-vulnerability). Wir praktizieren koordinierte Offenlegung und nennen die Meldenden.
