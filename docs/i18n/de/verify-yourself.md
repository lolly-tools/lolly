# Prüfen Sie es selbst

Jedes Versprechen auf dieser Website lässt sich ohne Konto überprüfen. Für die meisten Prüfungen reicht ein Browser; für den Rest brauchen Sie ein Terminal und eine Kopie des Quellcodes. Wenn eine der folgenden Prüfungen nicht das gezeigte Ergebnis liefert, ist das ein Fehler oder ein gebrochenes Versprechen, und wir möchten davon erfahren: siehe [Wenn eine Prüfung fehlschlägt](#if-a-check-fails).

Diese Prüfungen betreffen Lolly allein. Wenn Ihre Organisation Lolly Work betreibt, kommen Anmeldung, gemeinsame Inhalte, konfigurierte Telemetrie und Audit-Einträge hinzu; prüfen Sie diese anhand der [Server-Schnittstellen](/info/server-surface.html) und des [Organisationsabschnitts der Datenschutzerklärung](/info/privacy.html#organisation-services-with-lolly-work).

<!--i:eti-clock-->
## In zehn Sekunden sehen, wie es funktioniert

Öffnen Sie [`/verify`](/#/verify) und ziehen Sie eine Datei auf die Seite. Es gibt keinen Upload, kein Konto und kein Warten auf einen Server. Hier wird das [generierte Unwetter in Queensland](/info/ai-stance.html) aus Unsere Haltung zu KI geprüft: ein von Gemini generiertes Bild, das Lolly geöffnet, gekennzeichnet und konvertiert hat. Jedes Abzeichen wurde auf dem Gerät aus den Bytes der Datei selbst ermittelt.

![Lolly Verify auf einem Bildschirm in Smartphone-Breite: das Unwetterbild, ein grünes Urteil Made with Lolly und darunter die Abzeichen für intakte Credentials und unveränderte Bytes](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Das Urteil besteht aus einer kleinen Gruppe von Abzeichen, jedes für eine unabhängige Tatsache:

- <!--i:lock--> **Made with Lolly**: das Credential ist intakt *und* verzeichnet einen Lolly-Export.
- <!--i:seal--> **The credential is intact**: das signierte C2PA-Manifest lässt sich parsen, und seine eigene Claim-Signatur wird erfolgreich verifiziert.
- <!--i:hash--> **The bytes have not changed**: der Hashwert der Datei stimmt weiterhin mit dem signierten Wert überein. Ändern Sie ein Pixel, und dieses Abzeichen ändert sich.
- <!--i:sparkle--> **GEN AI**: eine Maschine hat diese Pixel erzeugt, und die Datei gibt das an. Lolly liest diese Angabe wieder aus, statt die Tatsache zu verbergen.

Der gesamte Verlauf reist mit der Datei. Hier bleiben neun Schritte erhalten: fünf, die Google beim Generieren und Versehen des Bildes mit Wasserzeichen aufgezeichnet hat, dann vier, die Lolly beim Öffnen, Kennzeichnen und Konvertieren der Kopie auf dieser Seite aufgezeichnet hat. Lolly Verify liest sie direkt aus den Bytes und stellt sie als Zeitleiste dar.

![Der Änderungsverlauf, den Lolly Verify aus dem Unwetterbild ausliest: fünf von Google aufgezeichnete Schritte, dann vier von Lolly, bis zum WebP auf dieser Seite](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Die folgenden Prüfungen sind die Garantien hinter dieser Demo, und jede lässt sich reproduzieren. [Content Credentials](/info/content-credentials-identity.html) erklärt jedes Urteil.

<!--i:eti-globe-->
## In Ihrem Browser, ohne zusätzliche Tools

::: timeline
- <!--i:globe--> **1. Beobachten Sie das Netzwerk.** Öffnen Sie [lolly.tools](https://lolly.tools), öffnen Sie die DevTools Ihres Browsers (F12), wechseln Sie zu **Network** und verwenden Sie ein Tool: Geben Sie eine Webadresse in [Lolly QR Code](/t/qr-code) ein, ändern Sie Farben, exportieren Sie ein PNG. Jede Anfrage geht an `lolly.tools`: die App-Shell, die eigenen Dateien des Tools und Katalog-Assets. Es gibt keinen Analytics-Host, keinen CDN-Beacon, keinen Schriftdienst und keinen Endpunkt für Fehlerberichte. Was Sie in ein Tool eingeben, erscheint **in keiner einzigen Anfrage**, weil lokal gerendert wird.
- <!--i:eyeoff--> **2. Trennen Sie die Verbindung.** Laden Sie die App und öffnen Sie ein oder zwei Tools, gehen Sie dann offline (Flugmodus oder DevTools → Network → Offline) und laden Sie neu. Die Galerie und jedes zuvor geöffnete Tool funktionieren weiter, einschließlich Rendering und Export in den von Ihnen verwendeten Formaten. Die Dateien eines Tools und der Encoder eines Formats werden bei der ersten Verwendung zwischengespeichert. Verwenden Sie ein Tool daher einmal online, bevor Sie es offline testen. Dies ist die aussagekräftigste Einzelprüfung auf dieser Seite: Software, die nach Hause funkt, funktioniert nicht weiter, wenn man ihr die Verbindung kappt.
- <!--i:check--> **3. Zählen Sie die Cookies.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Die Liste ist leer: Die App setzt keine Cookies. Fügen Sie `document.cookie` in die Konsole ein, und Sie erhalten `""`. Die optionale CA-Registrierung setzt ein kurzlebiges `HttpOnly`-Cookie, `lolly_ca_state`, beschränkt auf `/api/ca`, das `document.cookie` nicht anzeigen kann. Eine Lolly Work-Instanz verwendet eigene Anmelde-Cookies; vergleichen Sie diese mit dem Abschnitt [Datenschutz](/info/privacy.html#organisation-services-with-lolly-work).
- <!--i:layers--> **4. Lesen Sie Ihren eigenen Speicher aus.** Im selben Panel liegt alles vor Ihnen, was Lolly speichert: ein paar Dutzend einfache `localStorage`-Schlüssel (Design, Sprache, Breite der Seitenleiste, Ton- und Ansichtseinstellungen und eine zwischengespeicherte Kopie des öffentlichen Tool-Katalogindex) und Ihre eigenen Dokumente in IndexedDB. Jeder Wert ist eine lesbare Zeichenfolge oder JSON, nichts ist verschleiert. Das Löschen der Website-Daten entfernt diese lokalen Datensätze, aber keine Sync-Sicherung oder Datensätze, die eine Lolly Work-Instanz speichert. **Settings → Storage → Clear all my data** tut dasselbe aus der App heraus, und Sie können beobachten, wie sich die Speicher und Caches leeren.
- <!--i:lock--> **5. Prüfen Sie, ob es den Meldekontakt gibt.** [`/.well-known/security.txt`](/.well-known/security.txt) antwortet mit einem Kontaktblock nach [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116), keiner HTML-Seite.
:::

::: details Was Sie sonst noch im Tab Network sehen können
Einige Funktionen greifen nur auf das Netzwerk zu, wenn Sie sie verwenden, und jede ist im selben Tab sichtbar:

- das Hinzufügen einer **Google Font** in Lolly Design System Setup lädt diese eine Schriftfamilie von Google, nach einem Zustimmungsdialog, der dies einmal vor dem ersten Abruf erklärt;
- ein Klick auf eine **Voreinstellung für ein ICC-Druckprofil** lädt dieses Profil aus dem öffentlichen Verzeichnis des ICC unter color.org;
- das Abspielen des optionalen eingebauten **Radios** streamt vom Sender;
- die Eingabe eines Orts in **Meeting Planner** fragt dessen Koordinaten und Zeitzone beim Geocoding-Dienst von open-meteo ab, einmal pro Stadt (Antworten werden auf Ihrem Gerät gespeichert), und das Feld weist Sie bei der Eingabe darauf hin;
- **Lolly URL Screenshot** lädt die eingegebene Adresse, und Sie können dabei zusehen.

Ein Tool, das eine Netzwerkfähigkeit deklariert, darf nur von den Hosts abrufen, die sein Manifest ausdrücklich zulässt; bei einer fehlgeschlagenen Prüfung wird der Zugriff verweigert. Keines der derzeit ausgelieferten Tools deklariert eine solche Fähigkeit. Daher beschränkt die vom Browser durchgesetzte Content-Security-Policy die obige Liste auf ihre Hosts. Die [Datenschutzerklärung](/info/privacy.html) enthält die maßgebliche Tabelle all dieser Verbindungen, einschließlich des Datenverkehrs verwalteter Instanzen wie Richtlinienaktualisierungen und aktivierter Berichterstattung.
:::

<!--i:eti-code-->
## Vom Terminal aus

**6. Der Render-Endpunkt antwortet nur mit öffentlichen Daten.** Die eine Serverfunktion, die eingegebene Werte in eine URL schreibt, Hotlink-Renderings, ist hier aktiv. Die [Datenschutzerklärung](/info/privacy.html) erklärt, was das für die Eingaben bedeutet, die Sie in einen Link aufnehmen.

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Jede Bereitstellung entscheidet selbst (`LOLLY_DISABLE_RENDER_GET=1`): Auf einer Instanz, die diese Variable setzt, gibt dieselbe Prüfung `404` zurück. Dieser Unterschied zeigt, dass die Einstellung greift; er ist kein Widerspruch.

**7. Prüfen Sie die Dienste, die Ihre Bereitstellung aktiviert.** [Server-Schnittstellen](/info/server-surface.html) listet die optionalen Dienste auf und verlinkt ihre ausführlichen Referenzen. Beziehen Sie bei Lolly Work die authentifizierten APIs, die Verbindung für Zusammenarbeit, den Speicher und die konfigurierten Anbieter ein. Eine Prüfung des öffentlichen lolly.tools testet keine private Organisationsinstanz.

Wenn Sie Ihre eigene Instanz betreiben, enthält [Bereitstellung der Lieferung](/info/deploy-delivery.html) die Freigabeprüfungen: Modellintegrität, die Edge-Prüfung und ihre Stichprobenliste, Anzeigeversionen, das private Download-Gateway und den signierten Katalog in einem Browser.


<!--i:eti-search-->
## Im Quellcode

All das könnte immer noch bloße Fassade sein, wenn der bereitgestellte Code vom öffentlichen Code abwiche. Prüfen Sie also den Code. Die Bereitstellung wird aus [dem öffentlichen Repository](https://github.com/lolly-tools/lolly) gebaut:

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Keine Tracker und kein Analytics-SDK, nirgends.** Durchsuchen Sie den ausgelieferten Code (die Engine, jede Shell einschließlich Browser-Erweiterung, die Tauri-Bridge-Überschreibungen und den Service Worker, die Serverfunktionen und die Tool-Pakete) nach den üblichen Verdächtigen:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

Diese Suche prüft auf Tracking-SDKs von Drittanbietern. Sie belegt nicht das Fehlen eigener Nutzungsberichte: Lolly Work unterstützt Organisationstelemetrie und ein separates Audit-Protokoll mit eigenen Richtlinien und Tests.

**9. Kein DNS-Resolver eines Drittanbieters.** Die SEAL-Prüfung von Lolly Verify sendet nie eine Abfrage über einen DNS-over-HTTPS-Anbieter, weil die App keinen Resolver hat:

```bash
grep -rnF --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Der Zertifikatsdienst führt kein Ausstellungsprotokoll.** Die Identitäts-CA führt weder ein Protokoll ihrer ausgestellten Zertifikate noch ein Identitätsverzeichnis: keine stdout-Zeile, keinen Webhook, keinen Zertifikatsspeicher. Das lässt sich mit einer Suche überprüfen:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

Die CA hält allerdings kurzlebigen Arbeitszustand vor: Rate-Limit-Buckets speichern gehashte IP- und E-Mail-Schlüssel für ihr Zeitfenster, und der Zulassungsspeicher einer verwalteten Bereitstellung hält eine schlüsselbasierte Kennung und einen Anfrage-Hash höchstens zehn Minuten lang vor. [Technik der Content Credentials](/info/content-credentials-engineering.html#protocol) enthält die Details.

<!--i:eti-flask-->
## Durch Tests durchgesetzt

Die obigen Quellcodeprüfungen sind kein einmaliges Audit: Sie sind in der Testsuite verankert, damit sie nicht unbemerkt veralten. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) prüft eine längere Liste von Tracker-Namen als die obige Suche und lässt den Build fehlschlagen, wenn:

- irgendwo im durchsuchten ausgelieferten Quellcode ein Analytics- oder Tracking-SDK auftaucht, im Code von App, Engine, Server, Erweiterung oder Tool-Paketen;
- ein DNS-over-HTTPS-Resolver eines Drittanbieters in diesem Quellcode auftaucht;
- das CA-Ausstellungsprotokoll zurückkehrt, im Quellcode **oder** im erzeugten Server-Bundle;
- die Datenschutzerklärung ihre gesetzlich vorgeschriebenen Angaben verliert (namentlich genannter Verantwortlicher, Rechtsgrundlage, Beschwerderecht).

Führen Sie sie selbst im geklonten Repository aus (Node 22.18 oder neuer; diese Datei braucht kein `pnpm install`):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Die vollständige Suite (`pnpm install && pnpm test`) führt mehrere Tausend weitere Tests aus, einschließlich der in [Sicherheit & Verifizierung](/info/security.html) beschriebenen Kryptografietests unter Angriffsbedingungen.

<!--i:eti-eye-off-->
## Was Sie von außen nicht überprüfen können

- **Zugriffsprotokolle des Hostings.** Jeder Server kann die Anfragen protokollieren, die er beantwortet: IP-Adresse, Pfad und Zeitpunkt. Eine Prüfung von außen kann nicht feststellen, wie lange Protokolle aufbewahrt werden. Der Betreiber steuert Protokollierung, Rotation und Exporte und muss diese Entscheidungen offenlegen. Lokales Rendering hält gewöhnliche Bearbeitungen auf Ihrem Gerät; optionales Server-Rendering und Dienste für gemeinsame Arbeitsbereiche haben die separaten Datenflüsse, die die Datenschutzerklärung beschreibt.
- **Dass die Bereitstellung diesen Code ausführt.** Sie können prüfen, ob der Quellcode sauber ist und das Verhalten der Bereitstellung dem Quellcode entspricht; die obigen Prüfungen tun beides. Die Webplattform bietet keine Attestierung einer Webbereitstellung auf Binärebene. Absicherung bieten das öffentliche Repository, die verbindlichen Tests und die Offline-Prüfung: Eine manipulierte Bereitstellung, die nach Hause funkt, fällt sofort durch die Prüfungen 1 und 2.
- **Tool-Hooks.** Die optionale Logik eines eingebauten Tools wird geprüft, statt in einer Sandbox isoliert: Sie läuft auf der Seite, sofern das Tool nicht ausdrücklich einen Worker nutzt. Jedes Tool auf lolly.tools stammt vom Projekt selbst und wird vor der Auslieferung geprüft. Das [Bedrohungsmodell](/info/threat-model.html#trust-boundaries) beschreibt, wo Hooks laufen und was sie begrenzt.

<!--i:eti-warning-->
## Wenn eine Prüfung fehlschlägt

Eine Abweichung zwischen dieser Seite und Ihrer Beobachtung ist ein Sicherheitsbericht. Senden Sie ihn über die privaten Kanäle unter [Sicherheit & Verifizierung](/info/security.html#reporting-a-vulnerability). Wir praktizieren koordinierte Offenlegung und nennen die Meldenden als Quelle.
