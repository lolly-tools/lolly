# Browser-Erweiterung

Die Erweiterung **Lolly URL Screenshot** lässt die Web-App eine beliebige Webseite direkt aus Ihrem Browser heraus fotografieren. Ohne sie braucht das Erfassen einer URL die Desktop-App - eine Browserseite kann von sich aus keine Pixel von einer anderen Website lesen. Die Erweiterung kann das, mit derselben Aufnahmetechnik, die auch die Desktop-App nutzt.

Es erledigt auf dieselbe Weise noch eine weitere Aufgabe: eine einzelne von Ihnen genannte Seite zu lesen, damit Brand Studio eine Marke aus einer Live-Website ziehen kann. Beides wird unten behandelt.

Sie läuft auf Chromium-basierten Browsern: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 oder neuer.

Bis sie installiert ist, öffnet sich **URL Screenshot** trotzdem, sodass Sie eine Aufnahme zusammenstellen können, und ein Hinweis oben in den Werkzeugsteuerungen zeigt an, was fehlt.

![Der Hinweis des URL-Screenshot-Werkzeugs, der die Erweiterung anbietet, angezeigt wenn die Erfassung in eine Datei keinen Host zum Ausführen hat](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Jede Steuerung ist während des Wartens aktiv: die Ziel-URL, die Scroll-Tiefe, die Beruhigungspause, die Zuschnittsränder und das Umfärben. Nur die eigentliche Aufnahme braucht einen Host.

![Die URL-Screenshot-Steuerungen mit Ziel-URL, Scroll-Tiefe, Beruhigungspause und Zuschnittsrändern, alle nutzbar bevor die Erweiterung existiert](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Installation

### Aus dem Chrome Web Store

*Demnächst verfügbar.* Sobald sie veröffentlicht ist, installieren Sie sie mit einem Klick und laden Lolly neu.

### Selbst laden (Entwickler)

Die Erweiterung liegt im Repository unter `shells/chrome-extension/`.

1. Öffnen Sie `chrome://extensions`.
2. Schalten Sie den **Entwicklermodus** ein (oben rechts).
3. Klicken Sie auf **Entpackte Erweiterung laden** und wählen Sie den Ordner `shells/chrome-extension/`.
4. Laden Sie Lolly neu - **URL Screenshot** funktioniert jetzt im Browser.

## So funktioniert es

- Ein kleines Skript teilt Lolly mit, dass die Erweiterung vorhanden ist, sodass sich das Werkzeug **URL Screenshot** automatisch einschaltet - ohne Einrichtung.
- Beim Rendern öffnet die Erweiterung die Zielseite in einem Hintergrund-Tab, erfasst sie über das DevTools-Protokoll (dasselbe `Page.captureScreenshot`, das auch die Desktop-App nutzt), schließt dann den Tab und gibt das Bild zurück.
- Sie läuft vollständig in Ihrem Browser, in Ihrem Netzwerk - deshalb funktioniert auch das Erfassen von `localhost` oder einer internen Seite. Die Aufnahme selbst wird nirgends hochgeladen; der einzige Netzwerkverkehr ist Ihr eigener Browser, der die Seite lädt, die Sie fotografieren wollten.

Während eine Aufnahme läuft, sehen Sie kurz möglicherweise ein Banner *„…started debugging this browser“* auf dem temporären Tab. Das ist das DevTools-Protokoll bei der Arbeit; es verschwindet von selbst, sobald die Aufnahme fertig ist.

## Eine Website für Brand Studio lesen

Die Quelle **Website** in Brand Studio startet eine Marke aus einer bereits vorhandenen Website. Unter Chromium liest die Erweiterung sie; in der Desktop-App erledigt ein nativer Abruf dieselbe Aufgabe, und in einem einfachen Browser ohne Erweiterung wird die Kachel gar nicht erst angeboten.

Was passiert, wenn Sie darauf klicken:

- Eine Adresse, eine Seite. Die Erweiterung öffnet sie in derselben Art von Hintergrund-Tab, liest den gerenderten Quelltext, den Stylesheet-Text und eine Handvoll Icon- und Logo-Bilder, und schließt dann den Tab. Sie folgt keinen Links und durchsucht die Seite nicht.
- Auch anderswo gehostete Stylesheets und Schriften (ein CDN, ein Font-Dienst) werden abgerufen, weil die Farben und die Schrift der Seite darin stecken. Cross-Origin-Anfragen laufen ohne Ihre Cookies; Same-Origin-Anfragen nutzen sie, genau wie die Seite selbst es täte.
- Alles ist begrenzt - eine gedeckelte Anzahl an Sheets, Bildern und Bytes - sodass eine feindliche oder halb defekte Seite nur teilweises Material zurückgibt, statt hängen zu bleiben.
- Die Bytes gehen direkt zurück an den Lolly-Tab, der angefragt hat. Das Auswerten in Farben, Schrift und Logos geschieht auf Ihrem Gerät; nichts wird hochgeladen.

Nichts wird gelesen, bevor Sie klicken. Das Einfügen einer Adresse füllt nur das Feld aus.

## Nach der Installation

Laden Sie den Lolly-Tab neu. Die Aufforderung „Get the extension“ verschwindet, und **URL Screenshot** wird in der Galerie und im Batch-Modus verfügbar.

## Berechtigungen

Ihre `manifest.json` deklariert vier Berechtigungen sowie Host-Zugriff:

- `debugger` - steuert den Hintergrund-Tab über das DevTools-Protokoll. Das ist es, was den Screenshot aufnimmt.
- `tabs` - öffnet den temporären Hintergrund-Tab und schließt ihn danach wieder.
- `scripting` - führt den Ein-Seiten-Leser innerhalb der von Ihnen genannten Website aus, für die Brand-Studio-Quelle Website.
- `storage` - merkt sich die ID eines geöffneten Tabs, nur im Sitzungsspeicher, damit der Tab auch dann geschlossen wird, wenn der Browser die Erweiterung mitten im Lesevorgang pausiert. Wird beim nächsten Start gelöscht; nichts über Sie wird gespeichert.
- `host_permissions: ["<all_urls>"]` - Host-Zugriff auf *alle* Websites, weil Sie sie auf jede beliebige URL richten können. Chrome zeigt dies bei der Installation als breite Warnung „Alle Ihre Daten auf allen Websites lesen und ändern“ an.

Trotz dieser Warnung liest sie nur die einzelne Seite, die Sie zum Erfassen oder Importieren angeben, und sie liest oder überträgt Ihre Browserdaten nicht - nichts wird irgendwohin hochgeladen.

Das Manifest legt auch `minimum_chrome_version: 111` fest. Die aktuelle Version ist 0.2.1.

## Fehlerbehebung

- **Sehen Sie immer noch „Get the extension“?** Laden Sie den Lolly-Tab neu - die Erkennung erfolgt beim Laden der Seite.
- **Auf dieser Website passiert nichts?** Die Erweiterung aktiviert sich nur auf Lollys eigenen Ursprüngen. Betreiben Sie einen eigenen Build auf einer anderen Domain? Fügen Sie sie zu `content_scripts.matches` in der `manifest.json` der Erweiterung hinzu.
- **Eine Aufnahme schlägt fehl?** Prüfen Sie, ob die URL erreichbar ist und mit `http://` oder `https://` beginnt. Manche Seiten blockieren automatisierte Aufnahmen aktiv.
