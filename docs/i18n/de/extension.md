# Browser-Erweiterung

Die Erweiterung **Lolly URL Screenshot** lässt die Web-App eine beliebige Webseite direkt aus Ihrem Browser heraus fotografieren. Ohne sie braucht das Erfassen einer URL die Desktop-App - eine Browserseite kann von sich aus keine Pixel von einer anderen Website lesen. Die Erweiterung kann das, mit derselben Aufnahmetechnik, die auch die Desktop-App nutzt.

Sie erledigt auf dieselbe Weise zwei weitere Aufgaben. Eine in ein Bildfeld eingefügte Webadresse kann zu einem Screenshot dieser Seite werden (**Screenshot dieser Seite aufnehmen**), und die Erweiterung kann eine einzelne von Ihnen genannte Seite lesen, damit Brand Studio eine Marke aus einer Live-Website ziehen kann. Jede Anfrage wartet in der Erweiterung auf Ihre Freigabe.

Sie läuft auf Chromium-basierten Browsern: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 oder neuer.

Bis sie installiert ist, öffnet sich **URL Screenshot** trotzdem, sodass Sie eine Aufnahme zusammenstellen können, und ein Hinweis oben in den Werkzeugsteuerungen zeigt an, was fehlt.

![Der Hinweis des URL-Screenshot-Werkzeugs, der die Erweiterung anbietet, angezeigt wenn die Erfassung in eine Datei keinen Host zum Ausführen hat](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Jede Steuerung ist während des Wartens aktiv: die Ziel-URL, die Scroll-Tiefe, die Beruhigungspause, die Zuschnittsränder und das Umfärben. Nur die eigentliche Aufnahme braucht einen Host.

![Die URL-Screenshot-Steuerungen mit Ziel-URL, Scroll-Tiefe, Beruhigungspause und Zuschnittsrändern, alle nutzbar bevor die Erweiterung existiert](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Installation

### Aus dem Chrome Web Store

*Demnächst verfügbar.* Sobald sie veröffentlicht ist, installieren Sie sie mit einem Klick und laden Lolly neu.

### Selbst laden (Entwickler)

Die Erweiterung liegt im Repository unter `shells/chrome-extension/`. Dieser Ordner ist der Produktions-Build, der nur mit Lolly unter `https://lolly.tools` funktioniert.

1. Öffnen Sie `chrome://extensions`.
2. Schalten Sie den **Entwicklermodus** ein (oben rechts).
3. Klicken Sie auf **Entpackte Erweiterung laden** und wählen Sie den Ordner `shells/chrome-extension/`.
4. Laden Sie Lolly neu - **URL Screenshot** funktioniert jetzt im Browser.

Für einen lokalen Entwicklungsserver führen Sie `pnpm run pack:chrome-extension:dev` aus und laden stattdessen `dist/chrome-extension-dev`. Dieses Paket akzeptiert auch `http://localhost:5173` und hat **Development** im Namen.

## So funktioniert es

- Ein kleines Skript teilt Lolly mit, dass die Erweiterung vorhanden ist, sodass **URL Screenshot** Aufnahmen ohne weitere Einrichtung speichern kann.
- Sie geben jede Anfrage frei. Wenn Lolly anfragt, öffnet die Erweiterung ein eigenes Fenster **Approve page request**. Es zeigt die anfragende Website, ob ein Screenshot oder der Seiteninhalt gewünscht ist, und die Adresse der Seite. Nichts wird gelesen, bevor Sie auf **Approve once** klicken. **Cancel** oder das Schließen des Fensters beendet die Anfrage.
- Wenn Sie zum ersten Mal eine Anfrage für eine Website freigeben, fragt Chrome zusätzlich, ob die Erweiterung auf diese Website zugreifen darf. Chrome behält diesen Zugriff, sobald Sie ihn erlauben, aber jede spätere Anfrage braucht trotzdem ihr eigenes **Approve once**.
- Eine Freigabe gilt für eine Anfrage und läuft nach 30 Sekunden ab. Es kann nur eine Anfrage gleichzeitig warten oder laufen, und eine freigegebene Anfrage wird nach 55 Sekunden beendet. Wenn die Lolly-Seite geschlossen oder gewechselt wird oder die Zielseite zu einer anderen Website wechselt, wird die Anfrage abgebrochen.
- Nach Ihrer Freigabe öffnet die Erweiterung die Zielseite in einem Hintergrund-Tab, erfasst sie über das DevTools-Protokoll (dasselbe `Page.captureScreenshot`, das auch die Desktop-App nutzt), schließt dann den Tab und gibt das Bild an den Lolly-Tab zurück, der angefragt hat.
- Sie läuft vollständig in Ihrem Browser, in Ihrem Netzwerk - deshalb funktioniert auch das Erfassen von `localhost` oder einer internen Seite. Die Seite wird mit Ihrer Browsersitzung geladen, daher kann eine Seite, bei der Sie angemeldet sind, private Informationen im Ergebnis zeigen. Die Aufnahme selbst wird nirgends hochgeladen; der einzige Netzwerkverkehr ist Ihr eigener Browser, der die Seite lädt, die Sie fotografieren wollten.

Während eine Aufnahme läuft, sehen Sie kurz möglicherweise ein Banner *„…started debugging this browser“* auf dem temporären Tab. Das ist das DevTools-Protokoll bei der Arbeit; es verschwindet von selbst, sobald die Aufnahme fertig ist.

## Eine Website für Brand Studio lesen

Die Quelle **Website** in Brand Studio startet eine Marke aus einer bereits vorhandenen Website. Unter Chromium liest die Erweiterung sie; in der Desktop-App erledigt ein nativer Abruf dieselbe Aufgabe, und in einem einfachen Browser ohne Erweiterung wird die Kachel gar nicht erst angeboten.

Was passiert, wenn Sie darauf klicken:

- Eine Adresse, eine Seite. Nach Ihrer Freigabe öffnet die Erweiterung sie in derselben Art von Hintergrund-Tab, liest den gerenderten Quelltext, den Stylesheet-Text und eine Handvoll Icon- und Logo-Bilder, und schließt dann den Tab. Sie folgt keinen Links und durchsucht die Seite nicht.
- Auch anderswo gehostete Stylesheets (ein CDN, ein Font-Dienst) werden abgerufen, weil die Farben und die Schrift der Seite darin stecken. Cross-Origin-Anfragen laufen ohne Ihre Cookies; Same-Origin-Anfragen nutzen sie, genau wie die Seite selbst es täte.
- Alles ist begrenzt - eine gedeckelte Anzahl an Sheets, Bildern und Bytes - sodass eine feindliche oder halb defekte Seite nur teilweises Material zurückgibt, statt hängen zu bleiben.
- Die Bytes gehen direkt zurück an den Lolly-Tab, der angefragt hat. Das Auswerten in Farben, Schrift und Logos geschieht auf Ihrem Gerät; nichts wird hochgeladen.

Das Einfügen einer Adresse füllt nur das Feld aus. Nichts wird gelesen, bevor Sie das Lesen starten und auf **Approve once** klicken.

## Nach der Installation

Laden Sie den Lolly-Tab neu. Die Aufforderung „Get the extension“ verschwindet, **URL Screenshot** (unter Utilities) kann Aufnahmen in eine Datei speichern, und das Werkzeug wird im Batch-Modus verfügbar.

## Berechtigungen

Ihre `manifest.json` deklariert vier Berechtigungen, dazu Website-Zugriff, den sie für jeweils eine Website einzeln anfordert:

- `debugger` - steuert den Hintergrund-Tab über das DevTools-Protokoll. Das ist es, was den Screenshot aufnimmt.
- `tabs` - öffnet den temporären Hintergrund-Tab und schließt ihn danach wieder und prüft, dass sich weder die Lolly-Seite noch die Zielseite seit Ihrer Freigabe verändert hat.
- `scripting` - führt den Ein-Seiten-Leser innerhalb der von Ihnen genannten Website aus, für die Brand-Studio-Quelle Website.
- `storage` - merkt sich die ID eines geöffneten Tabs, nur im Sitzungsspeicher, damit der Tab auch dann geschlossen wird, wenn der Browser die Erweiterung mitten im Lesevorgang pausiert. Wird beim nächsten Start gelöscht; nichts über Sie wird gespeichert.
- `optional_host_permissions: ["http://*/*", "https://*/*"]` - Website-Zugriff, der bei der Installation nicht gewährt wird. Wenn Sie auf **Approve once** klicken, bittet die Erweiterung Chrome um Zugriff auf die eine Website dieser Anfrage, und Chrome fragt Sie bei jeder Website beim ersten Mal.

Sie liest nur die einzelne Seite, die Sie freigeben, und sie liest oder überträgt Ihre Browserdaten nicht - nichts wird irgendwohin hochgeladen.

Das Manifest legt auch `minimum_chrome_version: 111` fest. Die aktuelle Version ist 0.4.0.

## Fehlerbehebung

- **Sehen Sie immer noch „Get the extension“?** Laden Sie den Lolly-Tab neu - die Erkennung erfolgt beim Laden der Seite.
- **Auf dieser Website passiert nichts?** Die Erweiterung funktioniert nur auf `https://lolly.tools`, im Entwicklungspaket zusätzlich auf `http://localhost:5173`. Ein anderer Ursprung, etwa eine selbst gehostete Kopie von Lolly, braucht einen eigenen Build der Erweiterung, der diesen Ursprung sowohl in `manifest.json` als auch in `policy.js` aufführt. Nur die Manifest-Datei zu ändern funktioniert nicht mehr.
- **Eine Aufnahme schlägt fehl?** Prüfen Sie, ob die URL erreichbar ist und mit `http://` oder `https://` beginnt. Manche Seiten blockieren automatisierte Aufnahmen aktiv. Wenn Sie auf **Cancel** geklickt, das Freigabefenster geschlossen oder länger als 30 Sekunden gewartet haben, starten Sie die Aufnahme erneut.
