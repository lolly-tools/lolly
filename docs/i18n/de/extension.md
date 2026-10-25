# Browser-Erweiterung

Eine Webseite kann die Pixel einer anderen Website nicht lesen, daher braucht die Lolly-Web-App Hilfe, um eine Seite abzufotografieren. In einem Chromium-basierten Browser (Chrome, Edge, Brave, Arc oder Opera, ab Chrome 111) gibt die kostenlose Erweiterung **Lolly URL Screenshot** diese Hilfe, mit derselben Aufnahme, die die Desktop-App nutzt. Mit ihr installiert:

- **[URL Screenshot](/t/url-shot)** speichert die Seite, die Sie zusammengestellt haben, als Datei;
- eine in einen Bild-Slot eingefügte Webadresse kann mit **Screenshot this page** zu einem Screenshot dieser Seite werden;
- die Quelle **Website** in [Design System Setup](/info/brand-studio.html) kann eine Seite lesen, um ein Designsystem zu beginnen.

Sie geben jede Anfrage frei, und die Desktop-App erledigt dieselben Aufgaben ohne die Erweiterung.

## Vor der Installation

Solange die Erweiterung nicht installiert ist, öffnet sich **URL Screenshot** trotzdem, sodass Sie eine Aufnahme zusammenstellen können. Ein Hinweis oben bei den Steuerelementen des Tools sagt, was fehlt.

![Der Hinweis des URL-Screenshot-Werkzeugs, der die Erweiterung anbietet, angezeigt wenn die Erfassung in eine Datei keinen Host zum Ausführen hat](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Jedes Steuerelement funktioniert, während Sie warten: die Ziel-URL, die Scrolltiefe, die Beruhigungsverzögerung, die Beschnitt-Einzüge und die Umfärbung. Nur die Aufnahme selbst braucht die Erweiterung.

![Die URL-Screenshot-Steuerungen mit Ziel-URL, Scroll-Tiefe, Beruhigungspause und Zuschnittsrändern, alle nutzbar bevor die Erweiterung existiert](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Installation

**Aus dem Chrome Web Store:** demnächst. Sobald die Erweiterung veröffentlicht ist, installieren Sie sie mit einem Klick.

**Selbst laden (Entwickler).** Die Erweiterung liegt im Repository unter `shells/chrome-extension/`. Dieser Ordner ist der Produktions-Build, der nur mit Lolly unter `https://lolly.tools` funktioniert.

1. Öffnen Sie `chrome://extensions`.
2. Schalten Sie **Developer mode** ein (oben rechts).
3. Klicken Sie auf **Load unpacked** und wählen Sie den Ordner `shells/chrome-extension/`.
4. Laden Sie den Lolly-Tab neu. Die Erkennung geschieht beim Laden der Seite, sodass die Aufforderung "Get the extension" verschwindet. **URL Screenshot** (unter Utilities) kann dann Aufnahmen in eine Datei speichern und steht im Batch-Modus zur Verfügung.

Für einen lokalen Entwicklungsserver führen Sie `pnpm run pack:chrome-extension:dev` aus und laden stattdessen `dist/chrome-extension-dev`. Dieses Paket akzeptiert auch `http://localhost:5173` und hat **Development** im Namen.

## Was geschieht, wenn Lolly fragt

![Der Lolly-Tab bittet um eine Seite, und Sie drücken im Freigabefenster der Erweiterung Approve once. Ein Hintergrund-Tab öffnet sich, liest die Seite und schließt. Dann erhält der Lolly-Tab das Ergebnis.](/info/diagrams/concepts/extension-request.svg)

1. **Lolly fragt.** Ein kleines Skript teilt Lolly mit, dass die Erweiterung vorhanden ist, sodass eine Aufnahme oder ein Lesen einer Seite ohne weitere Einrichtung beginnen kann.
2. **Sie geben frei.** Die Erweiterung öffnet ihr eigenes Fenster **Approve page request**. Es zeigt die anfragende Website, ob sie einen Screenshot oder den Seiteninhalt will, und die Seitenadresse. Nichts wird gelesen, bis Sie **Approve once** drücken. **Cancel** oder das Schließen des Fensters beendet die Anfrage.
3. **Chrome fragt einmal pro Website.** Wenn Sie zum ersten Mal eine Anfrage für eine Website freigeben, fragt Chrome außerdem, ob die Erweiterung auf diese Website zugreifen darf. Chrome behält diesen Zugriff, sobald Sie ihn erlauben, aber jede spätere Anfrage braucht weiterhin ihr eigenes **Approve once**.
4. **Die Seite wird in einem Hintergrund-Tab gelesen.** Die Erweiterung öffnet die Zielseite in einem Hintergrund-Tab, nimmt sie über das DevTools Protocol auf (dasselbe `Page.captureScreenshot`, das die Desktop-App nutzt), schließt den Tab und gibt das Ergebnis an den Lolly-Tab zurück, der gefragt hat.

Eine Freigabe gilt für eine Anfrage und läuft nach 30 Sekunden ab. Nur eine Anfrage kann gleichzeitig warten oder laufen, und eine freigegebene Anfrage endet nach 55 Sekunden. Schließt oder ändert sich die Lolly-Seite oder wechselt die Zielseite zu einer anderen Website, wird die Anfrage abgebrochen.

Die Aufnahme läuft in Ihrem Browser, in Ihrem Netzwerk, sodass `localhost` und interne Websites funktionieren. Die Seite lädt mit Ihrer Browsersitzung, eine Seite, bei der Sie angemeldet sind, kann also private Informationen im Ergebnis zeigen. Die Aufnahme wird nicht hochgeladen: Der einzige Netzwerkverkehr ist Ihr eigener Browser, der die Seite lädt, um die Sie gebeten haben.

Während eine Aufnahme läuft, sehen Sie auf dem temporären Tab eventuell kurz ein Banner *"…started debugging this browser"*. Das ist das DevTools Protocol bei der Arbeit, und das Banner verschwindet, wenn die Aufnahme fertig ist.

## Eine Website für Design System Setup lesen

Die Quelle **Website** in Design System Setup beginnt ein Designsystem aus einer Website, die Sie schon haben. In einem Chromium-Browser liest die Erweiterung die Seite. In der Desktop-App ruft die App die Seite selbst ab. In einem Browser ohne Erweiterung wird die Kachel Website nicht angeboten.

- **Eine Adresse, eine Seite.** Nach Ihrer Freigabe öffnet die Erweiterung die Seite in derselben Art Hintergrund-Tab, liest das gerenderte Markup, den Stylesheet-Text und eine Handvoll Icon- und Logobilder und schließt dann den Tab. Sie folgt keinen Links und crawlt nicht.
- **Anderswo gehostete Stylesheets** (ein CDN oder ein Schriftdienst) werden ebenfalls abgerufen, weil die Farben und Schriften der Seite in ihnen liegen. Origin-übergreifende Anfragen gehen ohne Ihre Cookies; Anfragen desselben Origins nutzen sie, wie die Seite selbst es täte.
- **Alles ist begrenzt**, mit einer Grenze für die Zahl der Stylesheets und Bilder und für Bytes, sodass eine feindliche oder halb defekte Seite Teilmaterial zurückgibt, statt zu hängen.
- **Das Parsen geschieht auf Ihrem Gerät.** Die Bytes gehen direkt zurück an den Lolly-Tab, der gefragt hat, der daraus Farben, Schrift und Logos macht.

Das Einfügen einer Adresse füllt nur das Feld. Nichts wird gelesen, bis Sie das Lesen starten und **Approve once** drücken.

## Berechtigungen

Das `manifest.json` der Erweiterung deklariert vier Berechtigungen, dazu Websitezugriff, den sie für jeweils eine Website erfragt. Es setzt `minimum_chrome_version: 111`, und die aktuelle Version ist 0.4.0.

| Berechtigung | Wofür sie da ist | Wann sie gewährt wird |
|---|---|---|
| `debugger` | Steuert den Hintergrund-Tab über das DevTools Protocol, das den Screenshot aufnimmt. | Bei der Installation |
| `tabs` | Öffnet den temporären Hintergrund-Tab und schließt ihn danach und prüft, dass sich weder die Lolly-Seite noch die Zielseite seit Ihrer Freigabe bewegt hat. | Bei der Installation |
| `scripting` | Führt den Ein-Seiten-Leser innerhalb der von Ihnen genannten Website aus, für die Quelle Website. | Bei der Installation |
| `storage` | Notiert die ID eines von ihr geöffneten Tabs, nur im Sitzungsspeicher, damit der Tab auch dann noch schließt, wenn der Browser die Erweiterung mitten im Lesen aussetzt. Beim nächsten Start geleert; nichts über Sie wird gespeichert. | Bei der Installation |
| `optional_host_permissions: ["http://*/*", "https://*/*"]` | Websitezugriff, bei der Installation nicht gewährt. Wenn Sie **Approve once** drücken, bittet die Erweiterung Chrome um Zugriff auf die eine Website dieser Anfrage. | Wenn Sie zum ersten Mal eine Anfrage für diese Website freigeben, nachdem Chrome Sie gefragt hat |

Die Erweiterung liest nur die eine Seite, die Sie freigeben. Sie liest oder sendet Ihre Browserdaten nicht, und nichts wird hochgeladen.

## Fehlerbehebung

- **Sehen Sie weiterhin "Get the extension"?** Laden Sie den Lolly-Tab neu.
- **Passiert auf dieser Website nichts?** Die Erweiterung funktioniert nur auf `https://lolly.tools`, dazu `http://localhost:5173` im Entwicklungspaket. Ein anderer Origin, etwa eine selbst gehostete Kopie von Lolly, braucht einen eigenen Build der Erweiterung, der diesen Origin sowohl in `manifest.json` als auch in `policy.js` aufführt. Das Bearbeiten des Manifests allein genügt nicht.
- **Eine Aufnahme schlägt fehl?** Prüfen Sie, dass die URL erreichbar ist und mit `http://` oder `https://` beginnt. Manche Seiten blockieren automatisierte Aufnahmen. Wenn Sie **Cancel** gedrückt, das Freigabefenster geschlossen oder länger als 30 Sekunden gewartet haben, starten Sie die Aufnahme erneut.
