# Browser-Erweiterung

Eine Webseite kann die Pixel einer anderen Website nicht lesen. In einem Browser auf Chromium-Basis (Chrome, Edge, Brave, Arc oder Opera, ab Chrome 111) kann die Lolly-Web-App mit der kostenlosen Erweiterung **Lolly URL Screenshot** einen Screenshot einer Seite erstellen, mit derselben Aufnahmetechnik wie die Desktop-App. Mit installierter Erweiterung:

- speichert **[Lolly URL Screenshot](/t/url-shot)** die von Ihnen zusammengestellte Seite als Datei;
- kann eine in ein Bildfeld eingefügte Webadresse mit **Screenshot this page** zu einem Screenshot dieser Seite werden;
- kann die Quelle **Website** in [Lolly Design System Setup](/info/brand-studio.html) eine Seite einlesen, um ein Designsystem zu beginnen.

Sie genehmigen jede Anfrage, und die Desktop-App erledigt dieselben Aufgaben ohne die Erweiterung.

<!--i:eti-checklist-->
## Vor der Installation

Auch ohne die Erweiterung lässt sich **Lolly URL Screenshot** öffnen, und Sie können eine Aufnahme zusammenstellen. Ein Hinweis oben in den Steuerelementen des Tools sagt, was fehlt.

![Der Hinweis des Tools URL Screenshot auf die Erweiterung, der erscheint, wenn kein Host für die Aufnahme in eine Datei verfügbar ist](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Alle Steuerelemente funktionieren ohne die Erweiterung: die Ziel-URL, die Scrolltiefe, die Wartezeit zum Stabilisieren, die Beschnittabstände und die Umfärbung. Nur die Aufnahme braucht die Erweiterung.

![Die Steuerelemente von Lolly URL Screenshot mit Ziel-URL, Scrolltiefe, Wartezeit zum Stabilisieren und Beschnittabständen, alle schon vor der Installation der Erweiterung nutzbar](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

<!--i:eti-download-->
## Installieren

**Aus dem Chrome Web Store:** demnächst verfügbar. Nach der Veröffentlichung lässt sich die Erweiterung mit einem Klick installieren.

**Selbst laden (für Entwickler).** Der Quellcode der Erweiterung liegt im Repository unter `shells/chrome-extension/`. Der Paketierungsschritt erstellt aus diesem Ordner das Produktionspaket. Dieses Paket funktioniert nur mit Lolly unter `https://lolly.tools`.

1. Führen Sie `pnpm run pack:chrome-extension` aus. Dadurch wird das Paket in `dist/chrome-extension/` erstellt.
2. Öffnen Sie `chrome://extensions`.
3. Schalten Sie **Developer mode** ein (oben rechts).
4. Klicken Sie auf **Load unpacked** und wählen Sie den Ordner `dist/chrome-extension/`.
5. Laden Sie den Lolly-Tab neu. Lolly erkennt die Erweiterung beim Laden der Seite, und der Hinweis "Get the extension" verschwindet. **Lolly URL Screenshot** (unter Utilities) kann dann Aufnahmen als Datei speichern und funktioniert im Modus Lolly Batch.

::: details Für einen lokalen Entwicklungsserver oder den Quellordner
Führen Sie für einen lokalen Entwicklungsserver `pnpm run pack:chrome-extension:dev` aus und laden Sie stattdessen `dist/chrome-extension-dev`. Dieses Paket akzeptiert auch `http://localhost:5173` und trägt **Development** im Namen.

Für PNG-Screenshots können Sie auch den Ordner `shells/chrome-extension/` selbst laden. Diesem Ordner fehlt der Seitendurchlauf, den der Paketierungsschritt einbaut. Ein SVG aus diesem Ordner enthält einen Screenshot, keine Formen.
:::

<!--i:eti-user-check-->
## Was passiert, wenn Lolly anfragt

![Der Lolly-Tab fragt eine Seite an, und Sie drücken Approve once im Genehmigungsfenster der Erweiterung. Ein Hintergrund-Tab öffnet sich, liest die Seite und schließt sich. Dann erhält der Lolly-Tab das Ergebnis.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly fragt an.** Ein kleines Skript teilt Lolly mit, dass die Erweiterung vorhanden ist, sodass eine Aufnahme oder das Einlesen einer Seite ohne weitere Einrichtung beginnen kann.
2. **Sie genehmigen.** Die Erweiterung öffnet ihr eigenes Fenster **Approve page request**. Es zeigt die anfragende Website, ob sie einen Screenshot oder den Seiteninhalt möchte, und die Seitenadresse. Nichts wird gelesen, bevor Sie **Approve once** drücken. **Cancel** oder das Schließen des Fensters beendet die Anfrage.
3. **Chrome fragt einmal pro Website.** Wenn Sie zum ersten Mal eine Anfrage für eine Website genehmigen, fragt Chrome zusätzlich, ob die Erweiterung auf diese Website zugreifen darf. Chrome behält diesen Zugriff, sobald Sie ihn erlauben, aber jede spätere Anfrage braucht weiterhin ein eigenes **Approve once**.
4. **Die Seite wird in einem Hintergrund-Tab gelesen.** Die Erweiterung öffnet die Zielseite in einem Hintergrund-Tab, erfasst sie über das DevTools Protocol (dasselbe `Page.captureScreenshot`, das die Desktop-App verwendet), schließt den Tab und gibt das Ergebnis an den anfragenden Lolly-Tab zurück.

::: details Wie eine SVG-Aufnahme funktioniert
Für ein **SVG** durchläuft die Erweiterung die Seite, statt ein Bild des Bildschirms aufzunehmen. Ein mit der Erweiterung geliefertes Skript liest das Layout der Seite im Hintergrund-Tab und wandelt die Seite in Formen und Textumrisse um. Die Datei bleibt in jeder Größe scharf, und jeder Teil bleibt bearbeitbar. Bilder auf der Seite bleiben Bilder. Alles, was die Seite mit einem Canvas, einem Video oder einem Effekt zeichnet, den SVG nicht darstellen kann, wird aus einem Screenshot desselben Moments kopiert. Lolly prüft das Ergebnis anhand dieses Screenshots. Weichen beide zu stark voneinander ab, enthält das SVG stattdessen den Screenshot.

Um den Text in der Schrift der Seite als Umrisse darzustellen, übergibt die Erweiterung Lolly die Schriftdateien, die die Seite geladen hat. Chrome speichert die Bytes einer Schrift nicht dort, wo eine Erweiterung sie lesen kann. Daher fordert die Erweiterung jede Schrift erneut von der Seite an. Ihr Browser antwortet üblicherweise aus seinem Cache, und für diese Anfrage gilt weiterhin die Sicherheitsrichtlinie der Seite.
:::

Eine Genehmigung gilt für eine Anfrage und läuft nach 30 Sekunden ab. Es kann immer nur eine Anfrage warten oder laufen, und eine genehmigte Anfrage wird nach 55 Sekunden gestoppt. Wenn sich die Lolly-Seite schließt oder ändert oder die Zielseite zu einer anderen Website wechselt, wird die Anfrage abgebrochen.

::: warning Aufnahmen verwenden Ihre Browsersitzung
Die Seite wird mit Ihrer Browsersitzung geladen, sodass eine Seite, bei der Sie angemeldet sind, im Ergebnis private Informationen zeigen kann.
:::

Die Aufnahme läuft in Ihrem Browser in Ihrem Netzwerk, sodass `localhost` und interne Websites funktionieren. Die Aufnahme wird nicht hochgeladen. Der einzige Netzwerkverkehr entsteht, wenn Ihr Browser die angeforderte Seite und bei einem SVG deren Schriftdateien ein zweites Mal lädt.

Während einer Aufnahme sehen Sie auf dem temporären Tab möglicherweise kurz ein Banner *"…hat das Debuggen dieses Browsers gestartet"*. Das Banner stammt vom DevTools Protocol und verschwindet, sobald die Aufnahme fertig ist.

<a id="reading-a-site-for-design-system-setup"></a>
<!--i:eti-globe-->
## Eine Website für Lolly Design System Setup einlesen

Die Quelle **Website** in Lolly Design System Setup beginnt ein Designsystem anhand einer Website, die Sie bereits haben. In einem Chromium-Browser liest die Erweiterung die Seite ein. In der Desktop-App ruft die App die Seite selbst ab. In einem Browser ohne Erweiterung wird die Kachel Website nicht angeboten.

- **Eine Adresse, eine Seite.** Nach Ihrer Genehmigung öffnet die Erweiterung die Seite in einem Hintergrund-Tab derselben Art, liest das gerenderte Markup, den Stylesheet-Text sowie einige Symbol- und Logobilder und schließt dann den Tab. Die Erweiterung folgt keinen Links und durchsucht keine weiteren Seiten.
- **Andernorts gehostete Stylesheets** (auf einem CDN oder bei einem Schriftdienst) werden ebenfalls abgerufen, weil sie die Farben und Schriften der Seite enthalten. Cross-Origin-Anfragen werden ohne Ihre Cookies gesendet. Same-Origin-Anfragen verwenden Ihre Cookies, wie die Seite selbst.
- **Alles ist begrenzt**, sowohl die Anzahl der Stylesheets und Bilder als auch die Bytes, sodass eine bösartige oder teilweise defekte Seite unvollständiges Material zurückgibt, statt hängen zu bleiben.
- **Das Parsen erfolgt auf Ihrem Gerät.** Die Bytes gehen direkt an den anfragenden Lolly-Tab zurück, der sie in Farben, Schriften und Logos umwandelt.

Das Einfügen einer Adresse füllt nur das Feld aus. Nichts wird gelesen, bevor Sie das Einlesen starten und **Approve once** drücken.

<!--i:eti-lock-->
## Berechtigungen

Die `manifest.json` der Erweiterung deklariert vier Berechtigungen sowie den Website-Zugriff, den sie für jede Website einzeln anfragt. Sie setzt `minimum_chrome_version: 111`, und die aktuelle Version ist 0.5.0.

| Berechtigung | Wozu sie dient | Wann sie erteilt wird |
|---|---|---|
| `debugger` | Steuert den Hintergrund-Tab über das DevTools Protocol, das den Screenshot erstellt und bei einem SVG den Seitendurchlauf ausführt. | Bei der Installation |
| `tabs` | Öffnet den temporären Hintergrund-Tab und schließt ihn danach; prüft außerdem, dass seit Ihrer Genehmigung weder die Lolly-Seite noch die Zielseite die Adresse gewechselt hat. | Bei der Installation |
| `scripting` | Führt den Leser für eine einzelne Seite innerhalb der von Ihnen genannten Website aus, für die Quelle Website. | Bei der Installation |
| `storage` | Vermerkt die ID eines geöffneten Tabs ausschließlich im Sitzungsspeicher, damit der Tab auch dann geschlossen wird, wenn der Browser die Erweiterung während des Lesens pausiert. Wird beim nächsten Start geleert; nichts über Sie wird gespeichert. | Bei der Installation |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Website-Zugriff, der bei der Installation nicht erteilt wird. Wenn Sie **Approve once** drücken, fragt die Erweiterung Chrome nach Zugriff auf die eine Website dieser Anfrage. | Wenn Sie zum ersten Mal eine Anfrage für diese Website genehmigen, nachdem Chrome Sie gefragt hat |

Die Erweiterung liest nur die von Ihnen genehmigte Seite. Sie liest oder sendet keine Daten zu Ihrem Surfverhalten.

<!--i:eti-help-->
## Fehlerbehebung

- **Sie sehen noch immer "Get the extension"?** Laden Sie den Lolly-Tab neu.
- **Auf dieser Website passiert nichts?** Die Erweiterung funktioniert nur auf `https://lolly.tools` sowie im Entwicklungspaket auf `http://localhost:5173`. Ein anderer Ursprung, etwa eine selbst gehostete Kopie von Lolly, braucht einen eigenen Build der Erweiterung, der diesen Ursprung sowohl in `manifest.json` als auch in `policy.js` aufführt. Nur das Manifest zu bearbeiten reicht nicht.
- **Eine Aufnahme schlägt fehl?** Prüfen Sie, ob die URL erreichbar ist und mit `http://` oder `https://` beginnt. Einige Seiten blockieren automatische Aufnahmen. Wenn Sie **Cancel** gedrückt, das Genehmigungsfenster geschlossen oder länger als 30 Sekunden gewartet haben, starten Sie die Aufnahme erneut.
