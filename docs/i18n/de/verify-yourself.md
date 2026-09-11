# Überprüfen Sie es selbst

Lollys Datenschutz- und Sicherheitsseiten stellen Behauptungen auf: keine Analyse, kein Tracking, Dateien verlassen nie das Gerät, ein einziges Cookie im gesamten System. Diese Seite ist anders: Sie bittet Sie nicht, das einfach zu glauben. Es ist eine Liste von Verfahren, jedes mit dem genauen Befehl oder Klickpfad und dem Ergebnis, das Sie sehen werden. Jede Behauptung hier ist in Minuten widerlegbar, die meisten ohne irgendetwas zu installieren.

Wenn eine Prüfung auf dieser Seite nicht das gezeigte Ergebnis liefert, ist das entweder ein Fehler oder ein gebrochenes Versprechen. [Melden Sie es](#if-a-check-fails) in beiden Fällen, und wir behandeln es mit der Ernsthaftigkeit, die ein gebrochenes Versprechen verdient.

## In zehn Sekunden sehen, dass es funktioniert

Vor den Verfahren die Belohnung. Öffnen Sie [`/verify`](/#/verify) und legen Sie eine Datei darauf ab - kein Upload, kein Konto, kein Warten auf einen Server. Hier prüft es den [generierten Sturm über Queensland](/info/ai-stance.html) von unserer KI-Haltungsseite: ein Gemini-Bild, das Lolly geöffnet, verkleinert und exportiert hat. Jedes Abzeichen unten wurde auf dem Gerät berechnet, aus den eigenen Bytes der Datei.

![Verify auf einem Bildschirm in Telefonbreite - das Sturmbild, ein grünes Made-with-Lolly-Urteil und darunter die Abzeichen für intakte Zertifizierung und unveränderte Bytes](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

Das Urteil ist nicht ein einzelnes Abzeichen, sondern ein kleiner Stapel davon, jedes eine eigenständige Tatsache:

- <!--i:lock--> **Made with Lolly** - die Zertifizierung ist intakt *und* verzeichnet einen Lolly-Export.
- <!--i:seal--> **Die Zertifizierung ist intakt** - das signierte C2PA-Manifest lässt sich parsen und seine eigene Signatur verifiziert sich.
- <!--i:hash--> **Die Bytes haben sich nicht verändert** - der Hash der Datei stimmt noch mit dem überein, was signiert wurde. Ändern Sie ein einziges Pixel, und dieses Abzeichen kippt um.
- <!--i:sparkle--> **GEN AI** - eine Maschine hat diese Pixel erzeugt, und die Datei sagt das auch. Lolly liest diese Angabe aus, statt sie zu verbergen.

Und die gesamte Historie reist mit der Datei mit. Neun Schritte überleben hier - fünf hat Google beim Erzeugen und Wasserzeichnen des Bildes aufgezeichnet, vier weitere hat Lolly aufgezeichnet, als es die Kopie auf dieser Seite öffnete, markierte und konvertierte - direkt aus den Bytes ausgelesen, auf Ihrem Gerät, und als Zeitleiste dargestellt. Das ist dasselbe Bild, auf dieselbe Weise verifiziert wie die C2PA-Zeitleiste auf der [KI-Haltungsseite](/info/ai-stance.html).

![Die Änderungshistorie, die Verify aus dem Sturmbild ausliest - fünf Schritte von Google aufgezeichnet, dann vier von Lolly, endend im WebP auf dieser Seite](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

Das ist allerdings nicht das Vertrauensversprechen - das ist die Demo. Der Rest dieser Seite ist das Vertrauensversprechen: Jedes Badge oben ist reproduzierbar, und hier erfahren Sie, wie Sie die dahinterstehenden Garantien selbst nachvollziehen.

## In Ihrem Browser, ohne Werkzeuge

**1. Beobachten Sie den Netzwerkverkehr.** Öffnen Sie [lolly.tools](https://lolly.tools), öffnen Sie die DevTools Ihres Browsers (F12), wechseln Sie zum Tab **Network** und nutzen Sie ein Tool - geben Sie eine URL in [QR Code](/t/qr-code) ein, ändern Sie Farben, exportieren Sie ein PNG. Jede Anfrage bleibt auf `lolly.tools`: die App-Hülle, die eigenen Dateien des Tools, Katalog-Assets. Kein Analytics-Host, kein CDN-Beacon, kein Font-Dienst, kein „Error Reporting“-Endpunkt. Was Sie in ein Tool eingeben, erscheint in **überhaupt keiner Anfrage** - das Rendering ist lokal.

Die ehrlichen Ausnahmen - jede davon opt-in, vom Nutzer ausgelöst und im selben Network-Tab sichtbar, wenn sie passiert: Das Hinzufügen einer **Google Font** im Brand-Editor lädt genau diese eine Schriftfamilie von Google, nach einem Einwilligungsdialog, der genau das mitteilt, einmalig, vor dem ersten Abruf; ein Klick auf ein **ICC-Druckprofil-Preset** lädt dieses Profil aus dem öffentlichen Register des ICC bei color.org; das Abspielen des optionalen integrierten **Radios** streamt vom Sender; die Eingabe eines Ortes im **Meeting Planner** fragt diesen Ort beim Geocoding-Dienst von open-meteo nach Koordinaten und Zeitzone ab, einmal pro Stadt (Antworten werden auf Ihrem Gerät gespeichert), und das Eingabefeld trägt diesen Hinweis genau dort, wo Sie tippen; und **URL Screenshot** lädt notwendigerweise die von Ihnen eingegebene URL - das ist seine Aufgabe, und Sie sehen dabei zu. Ein Tool, das eine Netzwerk-Fähigkeit deklariert, darf nur von den in seinem Manifest zugelassenen Hosts abrufen, und dieser Mechanismus ist fail-closed; derzeit deklariert kein ausgeliefertes Tool eine solche, daher ist die vom Browser durchgesetzte Content-Security-Policy die Grenze, die die obige Liste tatsächlich auf ihre Hosts beschränkt. Die [Datenschutzerklärung](/info/privacy.html) führt die kanonische Tabelle all dessen; ihre feste Regel lautet: Ein Netzwerkzugriff, der nicht in dieser Tabelle steht, findet nicht statt.

**2. Ziehen Sie den Stecker.** Laden Sie die App, öffnen Sie ein, zwei Tools, gehen Sie dann offline - Flugmodus oder DevTools → Network → Offline. Laden Sie neu. Die Galerie und jedes von Ihnen geöffnete Tool funktionieren weiter, einschließlich Rendering und Export in den von Ihnen genutzten Formaten - die Dateien eines Tools und der Encoder eines Formats werden beim ersten Gebrauch zwischengespeichert, testen Sie ein Tool also einmal online, bevor Sie es offline prüfen. Das ist die stärkste einzelne Prüfung auf dieser Seite: Software, die nach Hause telefoniert, übersteht es nicht, wenn man ihr das Kabel kappt.

**3. Zählen Sie die Cookies.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. Die Liste ist leer - die App setzt keine Cookies. Oder fügen Sie `document.cookie` in die Konsole ein: Sie erhalten `""`. (Das einzige Cookie im gesamten System, `lolly_ca_state`, besteht höchstens zehn Minuten während einer optionalen Identitäts-Anmeldung - gelöscht in dem Moment, in dem die Anmeldung abgeschlossen ist -, ist auf `/api/ca` beschränkt und `HttpOnly`: Die [Datenschutzerklärung](/info/privacy.html) beschreibt es genau.)

**4. Lesen Sie Ihren eigenen Speicher.** Dasselbe Application-Panel: Alles, was Lolly aufbewahrt, ist direkt vor Ihnen einsehbar - ein paar Dutzend einfache `localStorage`-Schlüssel (Theme, Sprache, Sidebar-Breite, Sound- und Ansichtseinstellungen, plus eine zwischengespeicherte Kopie des öffentlichen Tool-Katalog-Index) sowie Ihre eigenen Dokumente in IndexedDB. Jeder Wert ist ein lesbarer String oder JSON - nichts ist verschleiert, nichts ist kodiert, um das Lesen zu erschweren. **Profile → Clear all my data** löscht das alles; ebenso das Löschen der Website-Daten im Browser, denn es gibt keine serverseitige Kopie, die das überstehen könnte.

**5. Prüfen Sie, ob die Meldekontaktadresse existiert.** [`/.well-known/security.txt`](/.well-known/security.txt) antwortet mit einem [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116)-Kontaktblock, nicht mit einer HTML-Seite.

## Vom Terminal aus

**6. Der Render-Endpunkt antwortet nur mit öffentlichen Daten.** Das eine Server-Feature, das von Nutzern eingegebene Eingaben in eine URL setzt - Hot-Link-Renders -, ist hier live, und die [Datenschutzerklärung](/info/privacy.html) erklärt, was das für die Eingaben bedeutet, die Sie in einen Link stellen:

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

Der Schalter gilt pro Deployment (`LOLLY_DISABLE_RENDER_GET=1`): Auf einer Instanz, die diese Variable setzt, liefert derselbe Test `404` zurück - dieser Unterschied ist das Kennzeichen dafür, dass der Schalter funktioniert, keine Inkonsistenz.

**7. Die Server-Oberfläche ist vollständig aufzählbar.** [Server Surface](/info/server-surface.html) listet jede serverseitige Route auf, die existiert, mit der festen Regel, dass ein Endpunkt, der nicht auf dieser Seite steht, nicht Teil von Lolly ist. Rufen Sie sie mit `curl` ab; es gibt nichts weiter zu finden.

## Im Quellcode

All das oben könnte trotzdem Theater sein, wenn der ausgelieferte Code vom öffentlichen Code abwiche. Prüfen Sie also den Code - das Deployment wird aus [dem öffentlichen Repository](https://github.com/lolly-tools/lolly) gebaut:

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
cd lolly
```

**8. Kein Tracker, kein Analytics-SDK, nirgends.** Durchsuchen Sie den ausgelieferten Code - die Engine, jede Shell (einschließlich der Browser-Erweiterung, der Tauri-Bridge-Overrides und des Service Workers), die Server-Funktionen und die Tool-Packs - nach den üblichen Verdächtigen:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. Kein DNS-Resolver eines Drittanbieters.** Die SEAL-Prüfung von Verify leitet Lookups nie über einen DNS-over-HTTPS-Anbieter - die Web-App hat schlicht keinen Resolver:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. Der Zertifikatsdienst speichert nichts.** Die Identitäts-CA führt kein Ausstellungsprotokoll - keine E-Mail-Adresse, keinen Zeitstempel, keinen Webhook. Die Abwesenheit lässt sich per grep nachweisen:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## Durch Tests durchgesetzt, nicht nur versprochen

Die drei Quellcode-Prüfungen oben sind kein einmaliges Audit - sie sind in der Testsuite verankert, damit sie nicht unbemerkt verfallen können. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) lässt den Build fehlschlagen, wenn:

- irgendein Analytics- oder Tracking-SDK an irgendeiner Stelle des durchsuchten ausgelieferten Quellcodes auftaucht - App, Engine, Server, Erweiterung und Tool-Pack-Code gleichermaßen,
- irgendein DNS-over-HTTPS-Resolver eines Drittanbieters in diesem Quellcode auftaucht,
- das CA-Ausstellungsprotokoll wieder auftaucht - im Quellcode **oder** im generierten Server-Bundle,
- die Datenschutzerklärung ihre gesetzlich erforderlichen Angaben verliert (benannter Verantwortlicher, Rechtsgrundlage, Beschwerderecht).

Führen Sie sie selbst im Klon aus (Node 22.18+; für diese Datei ist kein `npm install` nötig):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

Die vollständige Suite (`npm install && npm test`) führt mehrere Tausend weitere aus, einschließlich der in [Security & Verification](/info/security.html) beschriebenen adversariellen Kryptografie-Tests.

## Was Sie von außen nicht überprüfen können - klar ausgesprochen

Eine Seite wie diese verdient Vertrauen, indem sie ihre eigenen Grenzen benennt:

- **Zugriffsprotokolle des Hostings.** Jeder Server, der eine Anfrage beantwortet, kann diese Anfrage protokollieren - IP, Pfad, Zeitstempel. Sie können nicht überprüfen, was ein Host aufbewahrt oder nicht, und wir auch nicht, über das dokumentierte Verhalten unseres Anbieters hinaus. Genau deshalb hält die Architektur Ihre Inhalte vollständig von der Leitung fern: Was Ihr Gerät nie verlässt, kann von niemandem protokolliert werden.
- **Dass das Deployment diesen Code ausführt.** Sie können überprüfen, dass der Quellcode sauber ist und dass das ausgelieferte Verhalten dazu passt (die obigen Prüfungen decken beide Enden ab), aber eine binärgenaue Attestierung eines Web-Deployments bietet die Web-Plattform schlicht nicht an. Die Gegenmaßnahmen sind das öffentliche Repository, die erzwungenen Tests und die Offline-Prüfung - ein manipuliertes Deployment, das nach Hause telefoniert, scheitert sofort an Prüfung 1 und 2.
- **Tool-Hooks sind standardmäßig nicht sandboxed.** Die optionale Logik eines Tools läuft geprüft, im eigenen Realm der Seite; jedes Tool auf lolly.tools ist first-party und wird vor der Auslieferung geprüft. Worker-Isolation wird nun als Opt-in pro Tool ausgeliefert - ein Tool, dessen Manifest `isolate: true` setzt, führt seine Hooks stattdessen außerhalb des Haupt-Threads aus -, sodass sich der von außen nicht überprüfbare Bereich verkleinert, der Standardpfad aber weiterhin im selben Realm läuft und Review weiterhin die Kontrolle ist. Das wird ausgesprochen, nicht verschwiegen - siehe den Abschnitt [Design-Grenzen](/info/security.html), der das schon immer so gesagt hat.

## Wenn eine Prüfung fehlschlägt

Eine Abweichung zwischen dieser Seite und dem beobachteten Verhalten ist ein Sicherheitsbericht, und wir hören ehrlich lieber davon als nicht davon: [fitzy+security@suse.com](mailto:fitzy+security@suse.com), der Button **Report a vulnerability** in jedem [lolly-tools-Repository](https://github.com/lolly-tools) oder der Kontakt in [`/.well-known/security.txt`](/.well-known/security.txt). Koordinierte Offenlegung und Anerkennung der meldenden Person sind feste Richtlinie - [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) hat die Details.
