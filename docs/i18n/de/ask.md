# Ask Lolly

Ask Lolly beantwortet eine Frage mit dem passenden Abschnitt dieser Anleitungen, Wort für Wort zitiert, mit Quellenangabe der Seite und einem Link **Open in docs** zu diesem Abschnitt. Es wird nichts generiert: Die Antwort wird auf Ihrem Gerät gefunden und zitiert.

Unter dem zitierten Abschnitt stehen die Stellen in der App, die zur Frage passen: ein Tool, ein Utility, ein gespeichertes Projekt, ein Katalog-Asset, eine Einstellung oder eine Seite der App. Jede Zeile dient nur der Navigation. Nichts in einer Antwort ändert eine Einstellung, öffnet eine Datei oder handelt für Sie. Es gilt dieselbe Regel wie bei [Lolly Search](/info/search.html).

<!--i:eti-chat-->
## Eine Frage stellen

Tippen Sie in das Fragefeld am unteren Rand der Ansicht und drücken Sie Enter. Alles mit weniger als zwei Zeichen wird ignoriert. Antworten stehen übereinander über dem Feld, die neueste zuletzt.

![Ask Lolly, geöffnet und leer: das Fragefeld am unteren Rand der Ansicht mit dem Hinweis, dass Antworten aus der Dokumentation stammen](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

::: note Jede Frage steht für sich
Frühere Fragen liefern keinen Kontext. „Was ist mit PDF?“ nach einer Frage zum Export wird also nur als Frage zu PDF verstanden. Stellen Sie jedes Mal die vollständige Frage.
:::

Das erste Wort Ihrer Frage bestimmt, womit die Antwort beginnt:

| Sie beginnen mit | Was zuerst kommt |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | die passenden Stellen in der App |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | die passenden Tools |
| etwas anderem, einschließlich *how do I* und *what is* | der Dokumentationsabschnitt, wie standardmäßig vorgesehen |

Beide Teile werden immer abgerufen, sodass eine falsch verstandene Frage nur die Reihenfolge der Antwort ändert.

Der Abgleich lässt häufige Fragewörter weg (*how*, *do*, *I*, *the*, *my*). Er bewertet einen Abschnitt danach, wie viele Ihrer anderen Wörter darin vorkommen, und dann danach, wo sie gefunden wurden: Eine Überschrift zählt mehr als Fließtext. Der Abgleich sucht nach Teilzeichenfolgen und ignoriert Groß- und Kleinschreibung sowie Akzente, korrigiert also keine Tippfehler. Wenn nichts passt, meldet Ask dies und verweist auf das Inhaltsverzeichnis der Dokumentation.

**Better matching** ist optional. Nach Ihrer ersten Antwort kann Ask ein kleines Abgleichmodell samt Downloadgröße anbieten. Das Modell ordnet eine Frage einer Anleitung zu, die andere Wörter für dieselbe Sache verwendet. Es wird nur mit Ihrer Zustimmung heruntergeladen, läuft auf diesem Gerät und ändert nur, welche Abschnitte zuerst erscheinen. Die Antwort besteht weiterhin aus den eigenen Worten der Dokumentation. Sie können es auch als **Ask matching model** unter **Settings → Preferences → Available offline** herunterladen ([Offline verfügbar](/info/dashboard.html#available-offline)).

<!--i:eti-clipboard-->
## Was zurückkommt

Eine Antwortkarte hat eine feste Reihenfolge:

1. **Der Abschnitt selbst**, gerendert aus der Quelle der Dokumentation: Absätze, Listen, Tabellen, Code und Zitate, mit aktiven Links innerhalb der App und zu `/info`. Ein langer Abschnitt endet mit **Show more**, das den Rest an Ort und Stelle öffnet. Bilder werden weggelassen, und ein Link zu einer anderen Website erscheint als einfacher Text.
2. **Die Quellenangabe** - *Seite › Überschrift* - und der Link **Open in docs** zu genau diesem Abschnitt.
3. **More in the docs** - bis zu vier weitere passende Abschnitte als Links.
4. **Die Zeilen für Ziele in der App**, unter denselben Gruppenüberschriften wie in Search.

Der vollständige Text stammt aus der Markdown-Fassung, die jede Dokumentationsseite unter `/info/<slug>.md` veröffentlicht. Diese Fassungen gibt es nur auf Englisch. In einer anderen Sprache und auf den wenigen Seiten, die nicht aus Markdown erstellt werden, zeigt die Antwort stattdessen den kurzen Auszug aus dem Suchindex. Die Quellenangabe und der Link **Open in docs** verweisen weiterhin auf die Seite in Ihrer Sprache.

<!--i:eti-map-pin-->
## Wo Sie die Ansicht finden

Die Route ist `#/ask`. Sie hat weder einen Tab noch eine Kachel im Utilities-Raster. Sie erreichen die Ansicht über die Suchleiste oder ihre Adresse.

- <!--i:search--> **Über die Suche.** Jedes Ergebnispanel endet mit einer Zeile **Ask Lolly: *Ihre Suchanfrage*** unter den Ergebnissen der anderen Gruppen. Die Zeile öffnet `#/ask?q=…`, und die Ansicht stellt die Frage beim Öffnen einmal. Die Wörter kommen in Kleinschreibung ohne Satzzeichen an. Passen Sie sie bei Bedarf im Fragefeld an.
- <!--i:link--> **Über einen Link.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` öffnet die Ansicht mit dieser bereits gestellten Frage. Der Hash gibt nur die erste Frage vor. Fragen, die Sie danach eintippen, werden an Ort und Stelle beantwortet und ändern nie die Adresse.

Die Suchleiste ist in dieser Ansicht ausgeblendet, weil das Fragefeld Enter verwendet. Die Zurück-Pille bringt Sie dorthin zurück, wo Sie herkamen.

Antworten bleiben für diese Sitzung erhalten: Sie sind noch da, wenn Sie die Ansicht verlassen und zurückkehren. Ein Neuladen löscht sie. Nichts wird dauerhaft gespeichert, daher gibt es keinen Verlauf zu verwalten.

<!--i:eti-download-->
## Offline

Antworten stammen aus zwei statischen Dateien, die die Dokumentationswebsite veröffentlicht: dem Suchindex für die jeweilige Sprache und der Markdown-Fassung der Seite. Beide werden anhand ihres Namens abgerufen, sodass Ask ohne Verbindung funktioniert, sobald sie im Cache liegen. Wenn Sie die Anleitungen in der App lesen, werden sie im Cache gespeichert. **Guides & docs** unter [Offline verfügbar](/info/dashboard.html#available-offline) lädt die gesamte Website einschließlich Screenshots auf einmal herunter.

Ohne diese Dateien erscheint der Dokumentationsteil einer Antwort nicht, und es wird kein Fehler angezeigt. Die Zeilen für Ziele in der App erscheinen weiterhin, weil ihr Abgleich mit Daten erfolgt, die bereits auf dem Gerät liegen.

<!--i:eti-lock-->
## Datenschutz

Ihre Frage verlässt das Gerät nie. Der Abgleich läuft lokal mit Dateien, die anhand ihres Namens abgerufen werden. Ihre Eingabe ist daher kein Teil einer Anfrage. Kein Server sieht Ihre Frage, kein Konto enthält sie, und nach dem Neuladen bleibt keine Aufzeichnung zurück. Die [Datenschutzerklärung](/info/privacy.html) listet alles auf, was die App abruft oder sendet.

---

**Verwandte Themen:** [Lolly Search](/info/search.html) für die Leiste, die Fragen weitergibt. [Lolly verwenden](/info/using.html) für den Rest der App. [Lolly-Einstellungen](/info/dashboard.html#available-offline), um die Dokumentation zuerst offline verfügbar zu machen.
