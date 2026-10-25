# Ask Lolly

Tippen Sie eine Frage, und Ask Lolly antwortet mit dem Abschnitt dieser Anleitungen, der sie behandelt, Wort für Wort, mit der Angabe der Seite, aus der er stammt, und einem Link **Open in docs** direkt zu diesem Abschnitt. Nichts wird erzeugt: Die Antwort wird auf Ihrem Gerät abgerufen, zitiert und zugeordnet.

Unter dem zitierten Abschnitt stehen die Stellen in der App, die zur selben Frage passen: ein Tool, ein Utility, ein gespeichertes Projekt, ein Katalog-Asset, eine Einstellung oder eine Seite der App. Jede Zeile navigiert nur. Nichts in einer Antwort ändert eine Einstellung, öffnet eine Datei oder handelt für Sie, dieselbe Regel, der auch die [Suche](/info/search.html) folgt.

## Eine Frage stellen

Tippen Sie in das Fragefeld am Fuß der Ansicht und drücken Sie Enter. Alles unter zwei Zeichen wird ignoriert. Antworten stapeln sich über dem Feld, die neueste zuletzt, und Sie können weiterfragen.

![Ask Lolly, geöffnet und leer: das Fragefeld am Fuß der Ansicht, mit dem Hinweis, dass Antworten aus der Dokumentation stammen](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

Jede Frage wird für sich beantwortet: Frühere Fragen tragen keinen Kontext weiter, sodass "und was ist mit PDF?" nach einer Frage zum Exportieren als Frage nur zu PDF gelesen wird. Stellen Sie jedes Mal die ganze Frage.

Das erste Wort Ihrer Frage entscheidet, was die Antwort anführt:

| Sie beginnen mit | Was vorn steht |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | die passenden Stellen in der App |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | die passenden Tools |
| alles andere - auch *how do I* und *what is* | der Dokumentationsabschnitt, der Standard |

Beide Hälften werden immer abgerufen, sodass eine falsch gelesene Frage eine Antwort umsortiert, statt die halbe Antwort zu verlieren.

Beim Abgleich entfallen die üblichen Fragewörter (*how*, *do*, *I*, *the*, *my*), und ein Abschnitt wird danach gereiht, wie viele Ihrer übrigen Wörter er abdeckt, dann danach, wo sie passten: Eine Überschrift zählt mehr als Fließtext. Der Abgleich erfolgt per Teilzeichenfolge, unabhängig von Groß-/Kleinschreibung und Akzenten, sodass ein Tippfehler nicht korrigiert wird. Passt nichts, sagt Ask das und verweist auf das Dokumentationsverzeichnis, statt eine Antwort zu erfinden.

**Better matching** ist optional. Nach Ihrer ersten Antwort kann Ask ein kleines Abgleichmodell anbieten, mit seiner Download-Größe, das hilft, eine Frage einer Anleitung zuzuordnen, die für dieselbe Sache andere Worte nutzt. Es wird nur heruntergeladen, wenn Sie zustimmen, läuft auf diesem Gerät und ändert nur, welche Abschnitte zuerst stehen: Die Antwort bleibt in den eigenen Worten der Dokumentation. Sie können es auch unter **Settings → Preferences → Available offline** herunterladen, wo es als **Ask matching model** aufgeführt ist ([Available offline](/info/dashboard.html#available-offline)).

## Was zurückkommt

Eine Antwortkarte wird in fester Reihenfolge zusammengesetzt:

1. **Der Abschnitt selbst**, aus der Dokumentationsquelle gerendert - Absätze, Listen, Tabellen, Code und Zitate, mit funktionierenden Links in der App und nach `/info`. Ein langer Abschnitt wird mit **Show more** gekürzt, das ihn an Ort und Stelle öffnet. Bilder entfallen, und ein Link auf eine andere Website wird als einfacher Text statt als Anker gerendert.
2. **Die Quellenangabe** - *Seite › Überschrift* - und der Link **Open in docs** zu genau diesem Abschnitt.
3. **More in the docs** - bis zu vier andere passende Abschnitte, als Links.
4. **Die Zeilen in der App**, unter denselben Gruppenüberschriften, die die Suche nutzt.

Der volle Text stammt aus dem einfachen Markdown-Zwilling, den jede Dokumentationsseite unter `/info/<slug>.md` veröffentlicht, und diese Zwillinge gibt es nur auf Englisch. In einer anderen Sprache - und auf den wenigen Seiten, die nicht aus Markdown gebaut sind - fällt die Antwort auf den kurzen Auszug im Suchindex zurück statt auf den ganzen Abschnitt. Die Quellenangabe und der Link **Open in docs** sind in beiden Fällen da und zeigen auf die Seite in Ihrer eigenen Sprache.

## Wo es liegt

Die Route ist `#/ask`. Sie hat keinen Tab und keine Kachel im Utilities-Raster; die Wege hinein sind die Suchleiste und die Adresse selbst.

- <!--i:search--> **Aus der Suche.** Jedes Ergebnis-Panel trägt ganz unten eine Zeile **Ask Lolly: *Ihre Suchanfrage***, unter allen konkreten Treffern, die die anderen Gruppen fanden. Sie übergibt die Frage als `#/ask?q=…`, und die Ansicht stellt die Frage beim Eintreffen einmal. Die übergebenen Wörter kommen in Kleinbuchstaben und ohne Satzzeichen an; verfeinern Sie sie bei Bedarf im Fragefeld.
- <!--i:link--> **Aus einem Link.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` öffnet die Ansicht mit dieser bereits gestellten Frage. Der Hash ist nur der Einstiegswert: Fragen, die Sie danach tippen, werden an Ort und Stelle beantwortet und schreiben die Adresse nie um.

Die Suchleiste tritt in dieser Ansicht zur Seite, da das Fragefeld Enter annimmt, und die Zurück-Pille bringt Sie dorthin zurück, woher Sie kamen.

Die Antworten auf dem Bildschirm gelten für diese Sitzung: Sie sind noch da, wenn Sie wegnavigieren und zurückkommen, und ein Neuladen leert sie. Nichts wird im Speicher abgelegt, es gibt also keinen Verlauf zu verwalten.

## Offline

Antworten werden aus zwei statischen Dateien zusammengesetzt, die die Dokumentationsseite ohnehin veröffentlicht: dem Suchindex je Sprache und dem Markdown-Zwilling der Seite. Beide werden namentlich abgerufen, sodass Ask ohne Verbindung weiterarbeitet, sobald sie zwischengespeichert sind. Das Lesen der Anleitungen in der App speichert sie nebenbei zwischen, und **Guides & docs** unter [Available offline](/info/dashboard.html#available-offline) holt die ganze Website samt Screenshots in einem Download.

Ohne sie erscheint die Dokumentationshälfte einer Antwort einfach nicht, ohne Fehler. Die Zeilen in der App erscheinen weiterhin, weil sie mit Daten abgeglichen werden, die schon auf dem Gerät liegen.

## Datenschutz

Ihre Frage verlässt das Gerät nie. Der Abgleich läuft lokal gegen namentlich abgerufene Dateien, sodass das, was Sie getippt haben, nicht Teil einer Anfrage ist; kein Server sieht es, kein Konto ist damit verbunden, und nach einem Neuladen gibt es keine Aufzeichnung davon. Die [Datenschutzrichtlinie](/info/privacy.html) listet vollständig auf, was die App je abruft oder sendet.

---

**Siehe auch:** [Suche](/info/search.html) für die Leiste, die Fragen übergibt. [Lolly nutzen](/info/using.html) für den Rest der App. [Einstellungen](/info/dashboard.html#available-offline), um die Dokumentation zuerst offline zu holen.
