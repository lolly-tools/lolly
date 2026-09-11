# Datenschutzerklärung

*Zuletzt aktualisiert: 11. August 2026*

> **Kurzfassung.** Die Dokumente, Bilder, Videos und Dateien, die Sie in Lolly erstellen, bleiben
> auf Ihrem Gerät. Es gibt keine Konten für die normale Nutzung, keine Cookies von der App
> selbst und keine Analyse- oder Tracking-Tools irgendwo im Code - nicht „wir nutzen
> die Daten nicht“, sondern tatsächlich nicht im Quellcode vorhanden. Es gibt eine kurze, vollständige Liste von
> Ausnahmen, in denen die Software überhaupt mit einem Netzwerk spricht, und jede
> davon wird unten im Detail beschrieben: was das Gerät verlässt, an wen und wann. Die einzige
> Ausnahme, die etwas Persönliches betrifft, ist eine Anmeldung, die Sie ausdrücklich
> starten müssen. Steht es nicht in diesem Dokument, geschieht es nicht.

## Was diese Richtlinie abdeckt

Lolly ist Open-Source-Software - eine Engine, mehrere App-Shells (Web, Desktop,
Mobil, CLI) und eine Browser-Erweiterung -, die jeder betreiben kann. Diese Richtlinie hat zwei
Teile:

- <!--i:code--> **Die Software selbst**: was sie mit Ihren Daten tut und nicht tut, egal wo sie
  läuft. Das ist eine Eigenschaft des Codes, also gilt es für jede Lolly-Bereitstellung,
  unsere und die von jedem anderen.
- <!--i:server--> **lolly.tools**, die von SUSE betriebene Referenzbereitstellung: die konkreten Entscheidungen
  beim Betrieb ihrer optionalen serverseitigen Bausteine (was protokolliert wird, wie lange, von
  wem).

Wenn Sie eine selbst gehostete oder Enterprise-Lolly-Instanz verwenden, gilt das Softwareverhalten
unten weiterhin, aber der *Betreiber* dieser Instanz - nicht SUSE - ist
verantwortlich für alles Serverseitige: dessen Render-Endpunkt, dessen MCP-Server,
dessen Content-Credentials-Zertifizierungsstelle, falls er eine betreibt. Fragen Sie ihn nach
seiner eigenen Richtlinie. Siehe [Einführung & Governance](/info/adoption-governance.html) für
das, was der Betrieb von Lolly bedeutet.

## Die App: was auf Ihrem Gerät bleibt

Lollys Web-, Desktop- und Mobil-Shells führen die gesamte Render-Engine clientseitig aus.
Ein Tool öffnen, Eingaben ausfüllen, Vorschau anzeigen und exportieren geschehen alle auf Ihrem
Gerät - kein Server ist beteiligt, und die App funktioniert offline, sobald sie geladen ist.

**Die App setzt keine Cookies.** Um zu funktionieren, hält sie eine kleine Menge Daten **nur
auf Ihrem Gerät**, niemals übertragen:

- <!--i:sliders--> **Oberflächeneinstellungen** - Theme, Sprache, Toneinstellungen, Seitenleisten-/Zoom-
  Größe, Sortier- und Ansichtsauswahl, welche Onboarding-Hinweise Sie gesehen haben - in
  `localStorage`, damit sie verfügbar sind, bevor die App fertig gestartet ist.
- <!--i:download--> **Ein Offline-Cache des Tool-Katalogs und der Asset-Vorschauen**, damit die Galerie
  ohne Verbindung funktioniert.
- <!--i:hash--> **Lokale Nutzungszähler** für die Statistiken Ihrer Profilkarte (wie viele Exporte, welche
  Tools) - ein kleiner begrenzter Datensatz in `localStorage`, von uns nie gelesen, nie irgendwohin
  gesendet.
- <!--i:folder--> **Ihre eigenen Dokumente, gespeicherten Sitzungen, hochgeladenen Assets und Schriften** - gespeichert in
  IndexedDB auf Ihrem Gerät, nie hochgeladen, von niemandem außer Ihnen gelesen.

Nichts davon wird geteilt, verkauft oder zur Identifizierung oder Verfolgung genutzt. Es gibt nichts,
dem zuzustimmen wäre, weil keine Erhebung stattfindet - nur diesen Hinweis, damit Sie
wissen, was wo aufbewahrt wird. Löschen Sie alles jederzeit mit **Profil → Alle meine
Daten löschen**, oder indem Sie den Speicher der Seite in Ihrem Browser leeren. (Nach der ePrivacy-
Richtlinie Art. 5(3) benötigt eine Speicherung, die für den angeforderten Dienst unbedingt
erforderlich ist, keine Einwilligung - nur Transparenz, was sowohl dieses Dokument als auch
der In-App-Hinweis bieten.)

![Der Speicherbereich der Profilseite auf einem Bildschirm in Telefonbreite: jede Kategorie geräteinterner Daten benannt, mit der Schaltfläche „Alle meine Daten löschen“ direkt daneben](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Ihre eigene Sicherung dieser Daten - das `lolly-backup`-Bündel, erzeugt von **Meine
Daten exportieren & alles rendern** - ist eine Datei, die Sie behalten und kontrollieren. Sie berührt nie unsere
Server, es sei denn, Sie entscheiden sich, sie selbst irgendwohin zu senden. Siehe [Datenübertragung](/info/data-transfer.html).

## Geräteinterne Werkzeuge

Manche Tools - **Verborgene Daten entfernen**, **PDF komprimieren** und andere mit dem
**"Läuft auf Ihrem Gerät"**-Abzeichen - arbeiten mit einer Datei, die Sie bereitstellen. Die Datei wird
in den Arbeitsspeicher Ihres Browsers gelesen, lokal umgewandelt und als Download angeboten.
Sie wird nie hochgeladen, weil kein Server im Übertragungsweg vorhanden ist, an den sie hochgeladen werden könnte.
Diese Werkzeuge funktionieren offline, und ihre Ausgabe trägt kein Wasserzeichen und keine Metadaten von
uns - der Zweck der meisten von ihnen ist, Daten zu entfernen & zu schützen, nicht Risiken hinzuzufügen.

![Das Abzeichen, das diese Tools tragen: Läuft auf Ihrem Gerät - nichts wird hochgeladen](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=.on-device-badge&dark=1&filename=pv-ondevice-badge)

## Wenn die App mit einem Netzwerk spricht, vollständig

Die untenstehende Tabelle ist die vollständige Liste von allem, was die App über ein
Netzwerk abruft oder sendet. Steht es nicht hier, tut die App es nicht.

| Was | Was Ihr Gerät tatsächlich verlässt | Wann (die Handlung, die es auslöst) | Wenn ein Betreiber es blockiert |
|---|---|---|---|
| Tool-Katalog-Synchronisierung | Nichts Persönliches - eine Anfrage nach Lollys eigenem öffentlichen Tool- und Asset-Index, an den eigenen Ursprung der App | Beim Start, danach offline zwischengespeichert | Die App läuft mit ihrem zwischengespeicherten Tool-Satz. Sie hört nur auf, neue Tools zu entdecken |
| Ein Tool, das Live-Daten benötigt | Was auch immer dieses konkrete Tool anfragt, an den in seiner eigenen Beschreibung genannten Host. Heute ist das nur die Städtesuche im Tool Meeting Planner, das `geocoding-api.open-meteo.com` bittet, einen Städtenamen in Koordinaten und eine Zeitzone umzuwandeln - kein Konto, kein Schlüssel und keine Kennung über die Anfrage selbst hinaus. Das Eingabefeld weist genau dort, wo Sie tippen, darauf hin, und jede Antwort wird auf Ihrem Gerät gespeichert, sodass eine Stadt nur einmal nachgeschlagen wird | Nur während der Nutzung dieses Tools, und nur sobald Sie einen Ort eingeben | Nur diese eine Abfrage schlägt fehl. Sie können weiterhin Koordinaten von Hand eingeben, und nichts anderes ist betroffen |
| Google Fonts | Der gewählte Schriftfamilienname und Ihre IP-Adresse, an Googles Font-Server (`fonts.googleapis.com` für das Stylesheet, `fonts.gstatic.com` für die Schriftdatei) | Nur wenn Sie im Brand-Editor eine Google-Schrift hinzufügen, **und erst nachdem Sie dem in einem Dialog zustimmen, der genau das sagt** - ein einmaliger Abruf pro Familie, danach liegt sie auf Ihrem Gerät und wird offline verwendet | Der Google-Fonts-Auswähler schlägt kontrolliert fehl (fail closed). Laden Sie stattdessen eine Schriftdatei hoch |
| Senden an Google Drive | Die eine Datei, die Sie zum Senden ausgewählt haben, an Googles Drive-API (`www.googleapis.com`), nach einer Google-Anmeldung, die Sie in Googles eigenem Popup-Fenster abschließen. Lollys Zugriff ist auf von ihm erstellte Dateien beschränkt (der Bereich `drive.file` - es kann niemals den Rest Ihres Drive lesen), und das Anmelde-Token wird nur für die Dauer der Sitzung im Speicher gehalten, nie gespeichert | Nur wenn Sie bei einem EMF-Export auf "Send to Google Drive" klicken, und nur bei Builds, bei denen der Betreiber eine Google-Client-ID konfiguriert hat - ohne eine solche existiert die Schaltfläche nicht | Die Schaltfläche erscheint nie. Laden Sie die Datei selbst herunter und laden Sie sie zu Drive hoch |
| Senden an Dropbox | Die eine Datei, die Sie zum Senden ausgewählt haben, an die API von Dropbox (`api.dropboxapi.com` für Anmeldung und Metadaten, `content.dropboxapi.com` für die Datei selbst), nach einer Dropbox-Anmeldung, die Sie im eigenen Fenster von Dropbox abschließen. Lollys Zugriff ist auf den App-Ordner beschränkt (es sieht ausschließlich `Apps/` und den eigenen Ordner dort - niemals den Rest Ihrer Dropbox), der angezeigte "Open"-Link ist ein kurzlebiger privater Link (es wird keine öffentliche Freigabe erstellt), und ein Refresh-Token wird nur gespeichert, wenn Sie "stay connected" ankreuzen | Nur wenn Sie bei einer Datei auf "Send to Dropbox" klicken, und nur bei Builds, bei denen der Betreiber eine Dropbox-Client-ID konfiguriert hat - ohne eine solche existiert die Schaltfläche nicht | Die Schaltfläche erscheint nie. Laden Sie die Datei selbst herunter und laden Sie sie zu Dropbox hoch |
| Senden an OneDrive | Die eine Datei, die Sie zum Senden ausgewählt haben, an Microsofts Identitäts- und Graph-Dienste (`login.microsoftonline.com` für die Anmeldung, `graph.microsoft.com` für den Upload; eine große Datei wird in Teilen an eine Microsoft-eigene Upload-Adresse unter `api.onedrive.com`, `*.up.1drv.com` oder `*.sharepoint.com` hochgeladen), nach einer Microsoft-Anmeldung, die Sie in Microsofts eigenem Fenster abschließen. Lollys Zugriff ist auf den eigenen Ordner unter `Apps/` beschränkt (es kann niemals den Rest Ihres OneDrive lesen), zuzüglich Ihres Anzeigenamens für die Kontobezeichnung, und ein Refresh-Token wird nur gespeichert, wenn Sie "stay connected" ankreuzen | Nur wenn Sie bei einer Datei auf "Send to OneDrive" klicken, und nur bei Builds, bei denen der Betreiber eine Microsoft-Client-ID konfiguriert hat - ohne eine solche existiert die Schaltfläche nicht | Die Schaltfläche erscheint nie. Laden Sie die Datei selbst herunter und laden Sie sie zu OneDrive hoch |
| Senden an LinkedIn | Die eine Datei, die Sie zum Senden ausgewählt haben, plus deren Name als Text des Beitrags, an LinkedIn (`www.linkedin.com` für die Anmeldung, `api.linkedin.com` für den Upload und den Beitrag), nach einer LinkedIn-Anmeldung, die Sie in Ihrem eigenen Browser abschließen. Der Beitrag geht als öffentlicher Beitrag unter Ihrem Namen an Ihren eigenen Feed. Lolly kann als Sie posten und Ihren Namen für die Kontobezeichnung lesen, sonst nichts auf Ihrem LinkedIn, und die Anmeldung wird nur dann auf diesem Gerät gehalten, wenn Sie "stay connected" ankreuzen - LinkedIns Tokens gelten 60 Tage und können nicht im Stillen erneuert werden, laufen also von selbst ab | Nur wenn Sie bei einer Datei auf "Send to LinkedIn" klicken, nur in den Desktop-Apps, und nur bei Builds, bei denen eine LinkedIn-App konfiguriert ist - ohne eine solche existiert die Schaltfläche nicht | In der Web-App gibt es nichts zu blockieren: Dies existiert **nur in den Desktop-Apps**, daher stehen diese beiden Hosts bewusst NICHT in der Content-Security-Policy der Web-App weiter unten. Entfernen Sie in den Desktop-Apps die konfigurierte LinkedIn-App, und die Schaltfläche erscheint nie |
| ICC-Druckprofile | Nichts Persönliches - eine Anfrage nach einem Standard-Druckbedingungsprofil, an das öffentliche Register des ICC (`registry.color.org`, `www.color.org`) | Nur wenn Sie im Druckprofil-Manager eine ICC-Vorgabe anklicken - ein einmaliger Abruf pro Profil, danach liegt es auf Ihrem Gerät | ICC-Vorgaben schlagen fehl. Stellen Sie stattdessen Ihr eigenes `.icc`-Profil bereit |
| Internetradio | Nichts Persönliches - eine Playlist-Anfrage und ein Audiostream, an den Sender (`api.somafm.com` und den von ihm genannten Icecast-Server, `*.somafm.com`) | Nur solange Sie das optionale integrierte Radio im Sound-Player abspielen | Das Radio schlägt fehl. Jede andere Sound-Funktion funktioniert weiterhin |
| Eine URL, die Sie ein Tool erfassen lassen | Eine Anfrage an genau die Webadresse, die Sie eingeben, vom URL-Screenshot-Tool. Was auch immer diese Adresse ist. Dieser Host steht nicht in der Richtlinie weiter unten, weil Sie ihn im Moment der Nutzung selbst wählen | Nur wenn Sie in diesem Tool eine URL eingeben und die Erfassung starten | Ein Betreiber kann dies nicht nach Host auf eine Positivliste setzen. Um es zu entfernen, entfernen Sie das Tool |
| SEAL-Signaturprüfung | **Nichts.** Die Web-App hat überhaupt keinen DNS-Resolver - siehe unten | Nie | Nichts zu blockieren |
| KI-Modelle auf dem Gerät | Nichts Persönliches - ein einmaliger Download einer Modelldatei von Lollys Modell-Host (`lolli.li`), danach auf Ihrem Gerät zwischengespeichert; kein Konto, keine Kennung, nur die Anfrage und Ihre IP | Nur wenn Sie eine Funktion nutzen, die ein Modell benötigt (Verify-Tiefenscan, Bild-Upscaling, Sprache und Ähnliches) | Diese Funktion wartet auf den Download; alles andere funktioniert weiterhin |
| Remote-Instanz | Was auch immer die von Ihnen benannte Instanz zurückliefert, über dieselbe oben beschriebene Katalog-Synchronisierung - plus ein Versionskennzeichen bei Anfragen an sie (Shell-Art und Engine-Version, dieselbe Information, die ein User-Agent trägt), damit ihr Betreiber sehen kann, welche Lolly-Versionen im Einsatz sind. Bei einer verwalteten Instanz trägt dieses Kennzeichen, solange Sie angemeldet sind, außerdem eine geräteweise Installations-ID, damit die Geräteliste des Betreibers diese Installation unterscheiden kann. Es reitet nur auf Anfragen mit, die Ihre eigene Nutzung ohnehin schon stellt - es gibt keinen Timer, und nichts telefoniert von sich aus nach Hause - und beim Verlassen der Instanz wird die ID gelöscht, sodass ein Gerät, das sich später erneut verbindet, eine neue präsentiert. Sie wählen den Host im Moment der Nutzung, daher steht er nicht in der Richtlinie weiter unten | Nur wenn Sie die Shell explizit auf ein anderes Lolly-Deployment richten | Der Instanzwechsel schlägt fehl. Ihre lokale Instanz ist nicht betroffen |

Jeder feste Host in dieser Tabelle ist zugleich die vollständige Positivliste in der Content-Security-Policy der App, die der Browser durchsetzt. Die Liste ist also nicht nur eine Beschreibung dessen, was der Code heute tut, sondern die Grenze, an die der Browser die App bindet: Eine künftige Änderung, die versuchte, einen anderen Host zu kontaktieren, würde blockiert, nicht stillschweigend erlaubt. Eine Zeile ist die bewusste Ausnahme, und ihre eigene Zelle sagt das auch: Send to LinkedIn existiert nur in den Desktop-Apps, daher nennt die Richtlinie der Web-App keinen der beiden Hosts - die Web-App könnte sie nicht erreichen, selbst wenn ihr Code es versuchte. Zwei weitere Zeilen haben keinen festen Host, weil Sie die Adresse im Moment der Nutzung selbst wählen: eine URL, die Sie ein Tool erfassen lassen, und eine Remote-Instanz, auf die Sie die Shell richten. Keine von beiden steht in der Richtlinie, und beide treten nur ein, wenn Sie eine Adresse eingeben und darauf handeln. Ein Deployment, das keine der optionalen Verbindungen möchte (etwa eine Unternehmensinstanz mit eigenen Schriften), entfernt diese Hosts aus seiner Richtlinie, und die Funktionen schlagen dann kontrolliert fehl (fail closed), statt nach außen zu greifen.

Nichts davon sendet Ihre Dokumente, Projekte, Sitzungen oder hochgeladenen Dateien irgendwohin.
Sie existieren, um Dinge *zu* Ihrem Gerät zu bringen (Tools, Schriften, Modelle), nie um Dinge *von*
ihm zu senden, mit den in den Abschnitten unten ausdrücklich genannten Ausnahmen.

**Eine Anmerkung dazu, was wir entfernt haben.** Verify kann SEAL-Signaturen prüfen, ein Verfahren, bei dem
der Signierschlüssel einer Datei im DNS veröffentlicht wird. Browser können keine DNS-Anfragen stellen, also muss jede
Web-Implementierung die Abfrage über einen DNS-over-HTTPS-Resolver eines Dritten
leiten - was diesem Betreiber die geprüfte Domain plus Ihre IP-
Adresse zeigen würde. Wir nutzten früher den von Cloudflare. **Wir tun das nicht mehr, und es gibt keinen
Ersatz**: Die Web-App übergibt jetzt überhaupt keinen Resolver, sodass die SEAL-Verifizierung
hier null Netzwerkanfragen stellt. Dateien, deren SEAL-Datensatz den Schlüssel inline trägt,
verifizieren weiterhin vollständig offline. Dateien, deren Schlüssel im DNS liegt, melden "kein Schlüssel-
Resolver" stattdessen, und Sie können diese in der Desktop- oder Kommandozeilen-App prüfen,
die DNS nativ über Ihre eigene Maschine ohne Beteiligung Dritter auflösen.

![Der Verify-Bildschirm: ein Ablageziel und sonst nichts - die Datei wird dort geprüft, wo sie bereits liegt, ohne Upload und ohne Konto](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop) Sie können dies selbst nachprüfen: greifbare Prüfungen für diese und jede
andere Behauptung auf dieser Seite, mit den genauen Befehlen und erwarteten Ausgaben, finden Sie unter
[Verify It Yourself](/info/verify-yourself.html).

## Hot-verlinkte Render-URLs

> **Live auf lolly.tools.** Jede
> `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>`-URL wird tatsächlich gerendert, und die Eingaben
> reisen in dieser URL mit. Der Abschnitt unten erklärt, was das für Sie bedeutet, und
> ein Betreiber kann die Funktion auf seiner eigenen Instanz abschalten.

Die App selbst bleibt vollständig auf Ihrem Gerät. Separat kann ein Betreiber
**Hot-Link-Render-URLs** aktivieren - `/tool/<tool-id>.<ext>?<inputs>` -, sodass ein
geteilter Lolly-Link als Live-Bild in einer README, einem Wiki oder einem Dashboard erscheinen kann.
Einen solchen abzurufen bittet den Server, **öffentliche Tool- und Katalogdaten** mit den in
die URL geschriebenen Eingaben zu rendern.

- <!--i:usercheck--> **Keine Konten, keine Cookies, kein Zustand.** Der Endpunkt ist anonym, und es wird nichts
  auf Ihrem Gerät gelesen. Ihre Dokumente, Sitzungen und Uploads verlassen niemals Ihren
  Browser - sie können in diesen Links überhaupt nicht auftauchen.
- <!--i:document--> **Aber die URL selbst wird protokolliert.** Der Query-String einer URL ist Teil der Anfragezeile,
  daher erscheint er in den gewöhnlichen Zugriffsprotokollen der Hosting-Plattform, genauso
  wie jeder angeforderte Pfad. Enthalten die Eingaben eines Links den Namen oder die E-Mail-Adresse jemandes -
  ein Namensschild, eine E-Mail-Signatur - **steht dieser Text in diesen Protokollen**, und keine
  noch so sorgfältige Formulierung einer Richtlinie ändert das. Eine Hot-Link-URL ist deshalb der falsche Ort für persönliche Angaben: geben Sie ihr nur,
  was Sie auch auf eine öffentliche Seite stellen würden.
- <!--i:globe--> **Die Eingaben sind ohnehin von Natur aus öffentlich** - sie sind das, was die Autorin oder der Autor
  des Links in die URL getippt hat, lesbar für jeden, den der Link erreicht. Geben Sie keine
  Geheimnisse in einen geteilten Link. Lolly bietet Link-Verschlüsselung für sensible Inhalte an.
- <!--i:eyeoff--> Antworten werden **zwischengespeichert und ratenbegrenzt** wie jedes öffentliche Bild, und mit
  `noindex` markiert, damit Suchmaschinen Ihre Renderings nicht indexieren.

Hosten Sie Lolly selbst und möchten keine öffentliche Render-Oberfläche? Setzen Sie
`LOLLY_DISABLE_RENDER_GET=1`, und jede
dieser URLs liefert 404.

## Der MCP-Server (optional, für KI-Agenten)

Lolly kann auch von einem KI-Agenten über das Model Context Protocol erreicht werden - ein
von einem Betreiber betriebener Endpunkt (lolly.tools betreibt einen; jeder kann seinen eigenen selbst hosten,
einschließlich vollständig abgeschottet). Er teilt die Kein-Konten-Haltung des Render-Pfads,
plus drei Tools, die zwangsläufig Datei-Bytes verarbeiten:

- <!--i:cpu--> **`lolly_transform`** (ein geräteinternes Werkzeug serverseitig ausführen, im Auftrag
  des aufrufenden Agenten), **`lolly_verify`** (Content Credentials prüfen) und **`lolly_redact`**
  (Bereiche eines Bildes oder PDFs schwärzen) nehmen alle
  die Bytes einer Datei vom Aufrufer entgegen. Sie werden **im Prozess, im Arbeitsspeicher**
  verarbeitet, und das Ergebnis wird in demselben Aufruf zurückgegeben - die Datei wird nie auf
  Datenträger geschrieben und nie gespeichert, sobald die Anfrage abgeschlossen ist.
- <!--i:checklist--> Jedes andere Tool - `lolly_render`, `lolly_build_url`, `lolly_list_tools`,
  `lolly_describe_tool` - arbeitet nur mit Parametern (Text, Zahlen, Farben,
  URLs, Katalog-Asset-IDs), denselben Eingaben, die eine Hot-Link-Render-URL nimmt.
- <!--i:lock--> Der Zugriff ist entweder ein gemeinsames Token, das der Betreiber an vertrauenswürdige Clients ausgibt, oder
  zustandsloses OAuth 2.1: kurzlebige signierte Tokens, geprüft gegen ein gemeinsames
  Geheimnis, nichts serverseitig gespeichert, und das Token selbst wird nie in ein
  Protokoll oder eine Render-URL geschrieben.

## Content-Credentials-Identität (eine Anmeldung, die Sie selbst starten müssen)

Lolly kann Ihre Exporte mit einem kryptografischen **Content Credential** versiegeln, sodass jeder offline überprüfen kann, dass eine Datei seit dem Verlassen von Lolly unverändert ist. Das ist **standardmäßig aktiviert und vollständig lokal** - der Signierschlüssel wird auf Ihrem Gerät erzeugt, und das Signieren selbst geschieht offline. Ohne Registrierung ist dieser Schlüssel ein Wegwerfschlüssel: Für jeden Export wird ein frisches Schlüsselpaar erzeugt und zusammen mit ihm verworfen. Sobald Sie sich registrieren, wird der Schlüssel dauerhaft und **nicht extrahierbar** erzeugt - nicht einmal Lollys eigener Code kann ihn lesen, sondern ihn nur um eine Signatur bitten. So oder so verlässt er nie Ihr Gerät. Dieser Abschnitt behandelt den einen *optionalen* Schritt darüber hinaus: die Registrierung einer verifizierten Identität, sodass Ihre Exporte "Verifiziert - signiert von \<your email\>" anzeigen statt eines anonymen Schlüssels. **Wenn Sie die Registrierung überspringen, betrifft Sie nichts in diesem Abschnitt, und es verlassen niemals persönliche Daten Ihr Gerät.**

![Die Karte „Verifizierte Identität“ auf der Profilseite, Telefonbreite: der Zertifikatslaufzeit-Auswähler und der Registrierungsschritt darunter, ruhend, bis Sie ihn selbst starten](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Wenn Sie sich tatsächlich registrieren, geschieht genau Folgendes:

1. **Sie wählen eine Anmeldemethode** - GitHub, Google, SUSE (id.suse.com) oder einen
   per E-Mail zugesandten Link. Bei den drei OIDC-Anbietern werden Sie auf die eigene
   Anmeldeseite des Anbieters weitergeleitet, die dessen Datenschutzerklärung unterliegt, nicht unserer.
   Lollys Zertifikatsdienst erhält zurück nur eine verifizierte E-Mail-Adresse und
   den Namen des Anbieters. Beim E-Mail-Link wird die von Ihnen eingegebene Adresse an
   **Resend** übermittelt, eine transaktionale E-Mail-API, ausschließlich um diesen einen Link zuzustellen.
2. **Ein kurzlebiges Cookie schützt die Weiterleitung.** Das ist das einzige Cookie, das das
   gesamte Lolly-System setzt: `lolly_ca_state`, `HttpOnly`, auf `/api/ca` beschränkt,
   läuft innerhalb von zehn Minuten ab. Es trägt einen Zufallswert, keine Tracking-
   Kennung, und existiert nur, um zu verhindern, dass die OAuth-Weiterleitung gefälscht wird. Es wird
   gelöscht, sobald die Anmeldung abgeschlossen ist.
3. **Ihre IP-Adresse wird kurzzeitig verwendet, um Missbrauch** der Anmelde-
   Endpunkte zu verhindern (damit ein Skript nicht einen Posteingang zuspammen oder das E-Mail-Kontingent aufbrauchen kann) - nur
   im Server-Arbeitsspeicher gehalten, für ein gleitendes Fenster von etwa einer Minute, nie in ein
   Protokoll geschrieben oder irgendwo gespeichert.
4. **Der Zertifikatsdienst stellt ein kurzlebiges Zertifikat aus** (7, 30, 90 oder 365
   Tage, Ihre Wahl, begrenzt durch die Richtlinie des Betreibers), das Ihre verifizierte
   E-Mail-Adresse an die öffentliche Hälfte des auf Ihrem Gerät erzeugten Schlüsselpaars bindet. Die private
   Hälfte verlässt nie Ihren Browser.
5. **Nichts über die Ausstellung wird aufgezeichnet.** Der Zertifikatsdienst führt kein Ausstellungs-
   protokoll: nicht Ihre E-Mail, nicht den Anbieter, nicht eine Seriennummer, nicht einen
   Zeitstempel. Keine Datenbank, keine Protokollzeile, kein Webhook. Ihre E-Mail-Adresse existiert in
   der Anfrage nur so lange, bis sie in das Zertifikat geschrieben ist, das Ihr eigenes
   Gerät erhält, danach ist sie auf unserer Seite vollständig verschwunden.
6. **Danach ist das Signieren wieder offline**, für die gesamte Laufzeit des Zertifikats.
   Der Export einer Datei kontaktiert nie den Zertifikatsdienst - nur die Registrierung tat das.

**Der Kompromiss, unverblümt gesagt.** Eine frühere Version dieses Dienstes protokollierte tatsächlich jede
Ausstellung, damit ein fehlerhaft ausgestelltes oder kompromittiertes Zertifikat nachverfolgt werden konnte. Wir
haben das entfernt, weil dieses Protokoll die einzige Stelle in ganz Lolly war, an der personenbezogene
Daten auf einem Server zur Ruhe kamen, und wir sie lieber gar nicht halten als sorgfältig halten. Was wir aufgeben,
ist serverseitige Nachverfolgbarkeit: Wird ein Zertifikat missbraucht, können wir nicht nachschlagen, wer
es erhalten hat. Zertifikate sind von Natur aus kurzlebig - 7 bis 365 Tage, Ihre Wahl, begrenzt durch den
Betreiber - und laufen von selbst ab, was die Abhilfe ist, auf die wir stattdessen setzen. Selbst-Hoster, deren
eigene Pflichten ein Prüfprotokoll verlangen, können eines hinzufügen und werden dadurch zum
Verantwortlichen für diese Daten.

## Die Browser-Erweiterung

Die Browser-Erweiterung **Lolly URL Screenshot** erhebt, speichert oder überträgt keine
personenbezogenen Daten. Keine Analyse, kein Tracking, kein Remote-Server.

**Was sie tut.** Wenn Sie die Lolly-Web-App bitten, eine URL als Screenshot zu erfassen, öffnet die
Erweiterung diese Seite in einem temporären Hintergrundtab, erfasst sie in Ihrem
Browser über das DevTools-Protokoll, übergibt das Bild zurück an die App und schließt
den Tab. Alles geschieht lokal, auf Ihrem eigenen Gerät und Netzwerk.

**Daten.**

- <!--i:shieldcheck--> **Wir sammeln nichts.** Die Erweiterung hat keine Server und stellt keine eigenen
  Netzwerkanfragen.
- <!--i:photos--> **Erfasste Bilder** gehen direkt an die Lolly-App im selben Browser - sie werden nie
  von der Erweiterung hochgeladen.
- <!--i:link--> **Die URLs, die Sie erfassen,** werden nur verwendet, um diese eine Seite für diesen einen
  Screenshot zu laden. Sie werden nicht protokolliert oder weitergegeben.

**Berechtigungen.**

- <!--i:wrench--> **`debugger`** - um die gerenderte Seite über das DevTools-Protokoll zu erfassen (derselbe
  Mechanismus, den die Lolly-Desktop-App verwendet).
- <!--i:monitor--> **`tabs`** - um den temporären Tab zu öffnen und zu schließen, in dem die Seite geladen wird.
- <!--i:globe--> **Host-Zugriff (`<all_urls>`)** - weil die Seite, die Sie erfassen möchten, auf
  jeder beliebigen Site liegen kann. Chrome zeigt dies bei der Installation als umfassende
  Berechtigungswarnung an. Die Erweiterung besucht ausschließlich die URL, die Sie ihr angeben.

Keine dieser Berechtigungen wird verwendet, um Ihr Surfverhalten über diese eine
angeforderte Erfassung hinaus zu lesen, zu überwachen oder zu übertragen.

## Infrastruktur-Protokolle

Wie jede Website erzeugen die Server hinter lolly.tools - und hinter jeder Lolly-
Bereitstellung - standardmäßige Webserver-Zugriffsprotokolle, sobald überhaupt eine Anfrage sie
erreicht: IP-Adresse, angeforderter Pfad, Zeitstempel, User-Agent. Das ist grundlegendes
Hosting-Verhalten, nichts, was Lolly zusätzlich hinzufügt, und es enthält nie den
Inhalt Ihrer Dokumente, weil diese von vornherein nie einen Server erreichen. Die
eine bewusste Ausnahme ist eine Datei, die Sie ausdrücklich an einen MCP-Aufruf
`lolly_transform`, `lolly_verify` oder `lolly_redact` übergeben, der im Arbeitsspeicher verarbeitet und nie
auf Festplatte oder in ein Protokoll geschrieben wird, wie oben beschrieben.

**Lollys eigener Code schreibt nichts in diese Protokolle.** Der MCP-Server enthält überhaupt keine
Protokollierungsanweisungen. Der Zertifikatsdienst gibt genau zwei Zeilen aus, beide
nur bei einem Fehler und beide bewusst reduziert: ein Fehlercode für einen gescheiterten Versand ohne
Empfängeradresse, und eine Fehlermeldung ohne Stack-Trace oder URL (ein Stack könnte
ein Registrierungstoken enthalten). Alles andere im Protokoll stammt von der Hosting-Plattform,
nicht von uns.

Für lolly.tools ist Vercel der Hoster, und die Aufbewahrung der Zugriffsprotokolle folgt Vercels eigenen
Plattform-Standardwerten für unseren Tarif. Wir richten keinen Log-Drain, keinen langfristigen Log-
Export und kein zusätzliches Analyse- oder Monitoring-Produkt ein. Wir behalten selbst keine Kopie dieser
Protokolle, was auch bedeutet, dass wir keine Möglichkeit haben, sie für Sie zu durchsuchen - siehe
[Ihre Rechte](#your-rights).

## Rechtsgrundlagen, Aufbewahrung und Empfänger

Für fast nichts hier braucht es eine Rechtsgrundlage, weil fast nichts verarbeitet wird. Der
Vollständigkeit halber die gesamte Liste:

| Verarbeitung | Rechtsgrundlage (DSGVO Art. 6) | Aufbewahrt für |
|---|---|---|
| Alles auf Ihrem Gerät (Dokumente, Einstellungen, Cache, Zähler) | **Überhaupt keine Verarbeitung durch uns** - es erreicht uns nie. Speicherung auf Ihrem Gerät ist unbedingt erforderlich für den von Ihnen angeforderten Dienst (ePrivacy Art. 5(3)), daher ist keine Einwilligung nötig | Bis Sie es löschen |
| Ihre E-Mail-Adresse während der Content-Credentials-Registrierung | **Art. 6(1)(b)**, Erfüllung eines von Ihnen ausdrücklich angeforderten Dienstes | Nicht gespeichert. Nur für die Dauer der Anfrage im Arbeitsspeicher vorhanden |
| Ihre IP-Adresse an den Anmelde-Endpunkten, zur Ratenbegrenzung | **Art. 6(1)(f)**, unser berechtigtes Interesse, Missbrauch eines kostenlosen Dienstes und des E-Mail-Kontingents eines Dritten zu verhindern. Wir gehen davon aus, dass dies eine Interessenabwägung besteht, da es nur im Arbeitsspeicher vorliegt, nie aufgezeichnet und innerhalb von etwa einer Minute verworfen wird | ~1 Minute, im Server-Arbeitsspeicher, nie dauerhaft gespeichert |
| Hosting-Zugriffsprotokolle (IP, Pfad, Zeitstempel, User-Agent) | **Art. 6(1)(f)**, unser berechtigtes Interesse an Dienstsicherheit, Missbrauchsprävention und Fehlerdiagnose | Vercels Plattform-Standardwert für unseren Tarif. Wir fügen keinen Drain oder Export hinzu |

**Empfänger.** Die Kategorien von Empfängern sind: unser Hosting-Anbieter (Vercel
Inc.) und - nur wenn Sie die E-Mail-Anmeldeoption nutzen - ein Anbieter für Transaktions-E-Mails
(Resend). Wenn Sie sich mit GitHub, Google oder SUSE (id.suse.com) anmelden,
interagieren Sie direkt mit diesem Anbieter unter dessen eigener Datenschutzrichtlinie. Diese teilen
uns eine verifizierte E-Mail-Adresse mit und sonst nichts. Wir geben personenbezogene Daten an niemand
anderen weiter, und wir verkaufen keine Daten, betreiben keine Werbung und erstellen keine Nutzerprofile.

**Übermittlungen außerhalb des EWR.** Vercel und Resend sind US-Unternehmen. Die
Rechenleistung für lolly.tools ist an Vercels Frankfurt-Region (`fra1`) gebunden, sodass
die Verarbeitung in der EU stattfindet, aber als in den USA ansässige Anbieter können sie
weiterhin als Auftragsverarbeiter aus den USA auf Daten zugreifen. Diese Übermittlungen stützen sich auf die
Standardvertragsklauseln der Europäischen Kommission und/oder das EU-US Data Privacy
Framework, wie im Auftragsverarbeitungsvertrag jedes Anbieters festgelegt. Weil die
personenbezogenen Daten, die einen der beiden Anbieter erreichen, so begrenzt sind - eine E-Mail-Adresse, die
zum Versand einer Nachricht weitergegeben wird, und gewöhnliche Zugriffsprotokolle - ist die
Exposition entsprechend gering.

**Automatisierte Entscheidungsfindung.** Keine. Es gibt kein Profiling und keine automatisierte
Entscheidung, die rechtliche oder ähnlich bedeutsame Auswirkungen hat (Art. 22).

## Datenschutz für Kinder

Lolly sammelt wissentlich von niemandem, jeden Alters, im gewöhnlichen Verlauf der App-Nutzung
personenbezogene Informationen - es gibt nichts zu sammeln. Der einzige Ort, an dem
personenbezogene Informationen (eine E-Mail-Adresse) überhaupt erhoben werden, ist die oben beschriebene
Content-Credentials-Registrierung, die sich nicht an Kinder richtet und nicht für sie bestimmt ist.

## Ihre Rechte

Weil fast alles, womit Lolly in Berührung kommt, nur auf Ihrem eigenen Gerät gespeichert wird, sind die meisten
der Dinge, die das Datenschutzrecht "Ihre Rechte" nennt - Auskunft, Berichtigung, Löschung,
Datenübertragbarkeit - Dinge, die Sie bereits selbst tun können, sofort, ohne jemanden zu
fragen: Ihre Daten liegen im Speicher Ihres Browsers, in einer Form, die Sie einsehen, exportieren
(**Export my data & render everything**, oben) oder löschen können (**Profile → Clear all
my data**).

Formal haben Sie gemäß den Artikeln 15-22 DSGVO das Recht auf **Auskunft** über Ihre
personenbezogenen Daten, auf deren **Berichtigung**, auf deren **Löschung**, auf **Einschränkung**
oder **Widerspruch** gegen deren Verarbeitung (einschließlich Widerspruch gegen alles, was wir auf berechtigte
Interessen stützen), auf **Datenübertragbarkeit** und - wo die Verarbeitung auf Einwilligung beruht - auf
die **jederzeitige Widerrufung dieser Einwilligung**, ohne dass die Rechtmäßigkeit dessen berührt wird, was
vor dem Widerruf geschah.

Hier die ehrliche Position zur Ausübung dieser Rechte uns gegenüber. Da wir kein
Ausstellungsprotokoll mehr führen, **halten wir keine personenbezogenen Daten über Sie, die wir
nachschlagen, korrigieren, exportieren oder löschen könnten.** Wenn Sie uns schreiben und fragen, was wir
über Sie gespeichert haben, lautet die wahrheitsgemäße Antwort: nichts, und das werden wir Ihnen so sagen. Die einzige
überhaupt existierende Kategorie sind Hosting-Zugriffsprotokolle, die einer IP-Adresse zugeordnet sind und
von unserem Hosting-Anbieter nach dessen Standard-Aufbewahrungsfristen gehalten werden. Wir haben keine Möglichkeit, diese
zu durchsuchen oder selektiv zu löschen, und wir werden Ihnen das mitteilen, statt etwas anderes vorzugeben. Alles,
was tatsächlich *Ihnen* gehört, liegt auf Ihrem Gerät, wo Sie es bereits lesen, exportieren
und vernichten können, ohne jemanden um Erlaubnis zu fragen.

**Sie haben das Recht auf Beschwerde.** Wenn Sie glauben, dass wir Ihre Daten
unsachgemäß behandelt haben, können Sie eine Beschwerde bei einer Datenschutz-Aufsichtsbehörde
einreichen - in der EU die Behörde Ihres Wohnsitzlands, Ihres Arbeitsorts oder des Orts, an dem der
Verstoß Ihrer Meinung nach stattgefunden hat (Art. 77). Unsere federführende Aufsichtsbehörde ist das
*Bayerische Landesamt für Datenschutzaufsicht* (BayLDA) in Ansbach, Deutschland. Sie müssen sich
nicht zuerst an uns wenden, auch wenn wir gerne die Gelegenheit hätten, es zu beheben.

Wir verkaufen keine Daten. Wir haben keine zu verkaufen.

## Änderungen an dieser Richtlinie

Das Datum oben ändert sich, wann immer sich dieses Dokument ändert. Eine Änderung, die betrifft,
was Ihr Gerät verlässt oder was gespeichert wird, bekommt hier eine eigene Zeile, keine stille
Änderung - wenn Sie sehen möchten, was sich geändert hat, fragen Sie (unten) oder vergleichen Sie mit der
[öffentlichen Quelle](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

## Wer verantwortlich ist, und wie Sie uns erreichen

Der **Verantwortliche** für lolly.tools ist:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Deutschland

SUSE hat einen **Datenschutzbeauftragten** benannt, erreichbar unter
[privacy@suse.com](mailto:privacy@suse.com). Nutzen Sie diese Adresse für jede formale
Anfrage im Sinne von "Ihre Rechte" oben.

Für alles rund um Lolly selbst - wie es funktioniert, warum etwas so ist, wie es ist, oder
eine Korrektur an diesem Dokument - kontaktieren Sie **Andy Fitzsimon**,
[fitzy@suse.com](mailto:fitzy@suse.com).

Für eine selbst gehostete oder Enterprise-Lolly-Instanz kontaktieren Sie stattdessen den
Betreiber: Der Betreiber ist der Verantwortliche für seine eigene Bereitstellung. SUSE und das
Lolly-Open-Source-Projekt halten keine Daten für Bereitstellungen, die sie nicht selbst betreiben.
