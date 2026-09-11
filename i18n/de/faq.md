# FAQ

Häufige Fragen, die im Akkordeon auf der Landingpage `/info` angezeigt werden.

**So wird gepflegt:** Jede `##`-Überschrift unten ist eine Frage; alles darunter
(bis zur nächsten `##`) ist die Antwort. Die Antworten nutzen dasselbe schlanke Markdown wie
der Rest der Website - trennen Sie Absätze mit einer Leerzeile. Fügen Sie hier Fragen hinzu,
entfernen oder sortieren Sie sie um und führen Sie `npm run build:info` (oder `npm run dev:web`) erneut aus.
Alles oberhalb der ersten `##` (dieser Titel und diese Hinweise) wird beim Build ignoriert.

## Was passiert, wenn ich auf der Seite /profile zustimme?

Wenn Sie Lolly zum ersten Mal verwenden, bleibt alles, was Sie irgendwo eingeben, vollständig privat, bis Sie diese Informationen bewusst nach außen geben - über Medien oder einen Freigabelink (sofern online).

Wenn Sie zugestimmt haben, werden die von Ihnen gewählten Profildaten fest in das eingebettet, was Sie erzeugen, und nennen Sie als Quelle. Nichts wird aufgenommen, ohne dass Sie es auswählen.

Lolly erzeugt sehr viele Inhalte. Wir gehen streng nach dem Grundsatz der Datenminimierung vor, um Risiken zu vermeiden.

## Wurde Lolly "vibe coded"?

Lolly wurde mit KI-unterstütztem Coding, KI-unterstützter Recherche und, an vielen Stellen, KI-unterstützten Inhalten entwickelt, unter Verwendung einer Mischung aus Modellen und Anbietern, darunter auch solche von Public-Cloud-Frontier-Unternehmen.

Zum Zeitpunkt der Erstellung enthält Lolly null bekannte Sicherheitslücken in seiner Lieferkette und verpflichtet sich zu einer schnellen Reaktion auf Sicherheitsprobleme, sobald CVEs bekannt werden.

Ein Mensch hat die Architektur entworfen, den Code mit Bedacht kuratiert und das Erlebnis künstlerisch geleitet.

Vor allem aber steht Lolly auf den Schultern jahrzehntelanger Open-Source-Innovation echter Experten aus aller Welt.

Ein deterministisches Build-Gate existiert in Lollys Codebase, um Code und Dokumentation für den durchschnittlichen Leser kohärent zu halten und das Erlebnis zu "entschlacken". Dies kann es erschweren, die Herkunft mit proprietären synthetischen Verfahren automatisiert zu erfassen. Das ist unbeabsichtigt.

**Offenlegung zu generativer KI:**

- **Von LLMs geschriebener Code:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next (diese Liste kann erweitert werden)
- **LLM-Recherche:** Gemini 3.1, Fable
- **Dokumentation:** Sonnet 5
- **Open-Source-Bibliotheken:** ihre jeweiligen Autoren, ausgewiesen in der SBOM, in Kommentaren und Datei-Headern

Diese Liste umfasst keine Modelle, die fest in Lolly eingebunden sind.

**Menschlicher Beitrag:**

- **Architektur:** Andy Fitzsimon
- **Künstlerische Leitung:** Andy Fitzsimon
- **Von Menschen geschriebener Code:** Andy Fitzsimon
- **Ideenfindung, Review und Feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, die Penpot-Community (Liste nicht abschließend)

## Was sind die Feature-Flags?

Feature-Flags schalten Teile von Lolly ein oder aus. Üblicherweise steuert das eine Administratorin oder ein Administrator - bei Lolly haben Sie die Kontrolle.

![Jedes Feature-Flag ist ein Schalter, der Ihnen gehört - er sitzt in Ihrem eigenen Profil statt in einer Administrationskonsole](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Wie bekomme ich die Apps für Mobilgeräte oder den Desktop?

Jeder kann eigene Apps verteilen; die Werkzeuge und die Konfiguration dieser Apps unterscheiden sich stark, je nachdem, für welches Publikum sie gedacht sind. Es gibt also nicht die eine App - es sei denn, Sie haben sie selbst gebaut oder jemand aus Ihrem Umfeld gibt sie Ihnen.

## Warum der Name "Lolly Tools"?

**Lolly**, weil Freiheit süß ist und weil "lolly" in Australien, Neuseeland und Großbritannien eine Süßigkeit bedeutet.

**Tools**, weil ein Werkzeug still daliegt, bis Sie es in die Hand nehmen. Es läuft nicht, wenn Sie es nicht benutzen, und es beobachtet Sie nicht, während Sie es benutzen.

## Mit welchen Hürden muss ich bei der Einführung von Lolly rechnen?

Lolly fügt sich überall dort ein, wo Sie schon heute Dateien erzeugen - die CLI nutzt dieselbe
Engine wie die App, deshalb kann ein Pipeline-Lauf um 2 Uhr nachts nicht von dem abweichen, was
jemand im Browser sieht. Die Reibung bei der Einführung ist selten technisch, sondern organisatorisch. Rechnen Sie mit Folgendem:

**Ein kuratierter Markenkatalog muss erst entstehen.** Lolly ist eine Plattform, kein
fertiges Paket Ihrer Vorlagen. Für einen *gesteuerten Rollout* legt jemand den gemeinsamen
Asset-Katalog fest (Logos, Paletten, Schriften als dauerhafte IDs) und schreibt Manifest +
Template für jeden Ausgabetyp. Einzelne müssen darauf aber nicht warten - in der
offenen App kann jeder eigene Dateien in den Katalog übernehmen und vom ersten Tag an
Werkzeuge in Design bauen.

**Für Beiträge ist kein Git nötig.** Designerinnen und Designer bauen ihre eigenen Werkzeuge
und Vorlagen direkt in der App, teilen sie mit Kolleginnen und Kollegen oder reichen sie bei
den Betreibern des Deployments ein, damit sie standardmäßig ausgeliefert werden.

**Es ist bewusst eng gefasst - stellen Sie es auch so dar.** Lolly ist nicht für maßgeschneiderte
Einzelstücke gedacht. Es *ist* Ihr persönliches DAM - gespeist und verstärkt durch Ihr
Designsystem, Ihre Werkzeuge und Ihren Katalog - und es *hat* eine offene Arbeitsfläche (Design),
doch auch dort richten sich Farben, Typografie und Assets nach den aktiven Design-Globals,
sodass freies Anordnen innerhalb des Systems bleibt. Gemessen an Figma oder Canva wirkt es
begrenzt. Gemessen an dem, was es ist - operationalisierte, wiederkehrende Asset-Erzeugung in
großem Umfang - hält nichts mit. Die falsche Einordnung ist der häufigste Rückschlag.

**Veränderung auf der Produktionsseite begleiten.** Bestehende Abläufe funktionieren heute, auch wenn
das Ergebnis nicht markenkonform ist. Sie auf die Engine umzustellen heißt: neu testen, neu lernen,
und "wir können doch schon Dateien erzeugen" wird zur Ausrede, nicht zu migrieren. Beginnen Sie damit,
eine gut sichtbare Ausgabe in Produktionsqualität umzustellen und Vorher/Nachher nebeneinander zu zeigen.

Lolly hebt alles auf ein höheres Niveau.


## Was unterscheidet Utilities von Tools?

**Kurze Antwort →** Utilities müssen nicht immer etwas rendern und können deshalb eine andere Bedienoberfläche bekommen. 

**Eigentliche Antwort →** Utilities laufen deshalb in Lolly Tools, weil sie eine weitere 'Bequemlichkeitsschicht' der Verteidigung hinzufügen, die Datenabfluss unattraktiv macht. 

Warum? Weil bekanntermaßen jeden Tag Menschen **vertrauliche Inhalte, die sie ohnehin schon haben**, nehmen und sie
einer beliebigen Website übergeben, damit sie einen kleinen mechanischen Handgriff erledigt:

- "**Dieses PDF komprimieren**" → lädt einen Vertrag / eine Gehaltsabrechnung / eine Vorstandspräsentation zu unbekannten Anbietern hoch.
- "**HEIC in JPG umwandeln**" → lädt private Fotos (samt GPS-EXIF) zu einem werbefinanzierten Anbieter hoch
- "**dieses Bild zuschneiden / skalieren**" → lädt einen Produkt-Screenshot oder ein unveröffentlichtes Asset hoch
- "**dieses JSON formatieren**" / "dieses JWT dekodieren" → fügt API-Antworten, Tokens und Geheimnisse in einen Formatierer ein
- "**diese PDFs zusammenführen**" → lädt **zwei Dokumente hoch, die niemals denselben Server teilen dürften**

Diese Seiten und die unzähligen Klone in ihrem Windschatten sind **standardmäßig nicht vertrauenswürdig**:
unbekannte Aufbewahrung, unbekannte Rechtsräume, unbekannte Unterauftragsverarbeiter und ein Werbe- bzw.
Affiliate-Geschäftsmodell, das jeden Anreiz hat, zu behalten, was Sie ihm geben. Der Vorgang ist
trivial; **der Preis ist der Inhalt.** 

Wir gewinnen den Kampf um Governance mit hervorragendem Komfort und gutem Service. 

![Die Utilities-Ansicht bündelt die mechanischen Aufgaben, die man sonst einer beliebigen Website überlässt - hier laufen sie stattdessen in Lolly](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Kann Lolly meine Figma-, Penpot-, Illustrator- oder InDesign-Dateien bearbeiten und rendern?

Ja. Öffnen Sie **Design** und klicken Sie auf **Import a design**: Akzeptiert werden eine native Figma-Datei **.fig** (Save local copy), ein Penpot-Export **.penpot**, eine Illustrator-Datei **.ai** oder **.pdf**, eine InDesign-Datei **.idml** (File → Export → InDesign Markup) oder **jedes SVG** (die breite Tür - fast jede Design-App exportiert es). Kein Konto, kein Plug-in und keine Lizenz für eine Design-App nötig.

![Design's open canvas - Import a design sits in the toolbar's Lolly menu](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17VVRa9swEP41ekyQLrbjPOyhVeeOrSsbG3lXbLkYZCnISmn264tO9irFhdJCoZQIpBNn9N2dvu_k3cOX1opeEuCTpeNkG0BDy8ljZe28pyDA74UlUC4WOyt0sxgOthW1JJAD9wv1y6rFQWCDMB6BAK-NdqLTBLg2thcqeAnk68vaKGOXg-yFdl29dPLBef8VAZ6V_qjUTloCvO-aRvlcc0QdhB58iCWDMVNnD1iSUIOcAvASY2qsEUeex-XSOEJ6koaT_6Q1iY89IY4mw4TCmmJYc9BNZKPQ00ywxxJS-BlqcnL2KfJF3xhZf3WdwwsMd8xZ4VEgEF6EGornaH-ByW_iHkVAj-aAtpcO7Y1R6kggX1Uz7ext1wt7PNEOk7BZ7UbtYCpKtj4NZ_YE-Doh_hOwHnff-1K_M83xlPmyiJhn8AbmL5C61nZSN8g00OlFoK2xkyjCRofOBro3g5N2OdPE2PqxIGjL1iCCIPA1SPSQpQ_B6qyIVyiCsp8s-_Gn2P76fpHfVlt6WV3_Lv5e5_6mul7cSVRFhiWhOIrsaaVTMbKZaUWNbQ-VMncGN__b_fwn-CAKeAQ&width=1360&height=850&dpi=192&waitMs=3000&format=png&localize=1&dark=1&filename=design)

Ebenen kommen als bearbeitbare Kästen auf der offenen Arbeitsfläche an: Text bleibt neu tippbar, Formen bleiben Formen, Bilder wandern in Ihre eigene Bildbibliothek und Schrift und Farben richten sich nach den Marken-Globals. Speichern Sie das Layout, und es wird zu einer wiederverwendbaren, per URL adressierbaren Vorlage, die jeder mit Lolly neu befüllen kann - und Sie können lebende Werkzeuge einmischen (einen QR-Code, ein Diagramm), die beim Laden neu gerendert werden. Von da an rendert es wie alles andere in Lolly - SVG, PDF, PNG und den Rest, reproduzierbar aus seiner URL. Siehe [Import a design](/info/design-import.html).

## Kann ich meine Arbeit als Datei statt als Link teilen?

Ja. Wenn ein Link nicht alles mitnehmen kann (eigene Fotos, lange Texte), sagt der Share-Dialog genau, was verloren ginge, und bietet stattdessen eine **.lolly**-Datei an: eine Datei mit dem Design, den verwendeten Bildern und, wenn Sie möchten, dem Werkzeug selbst. Sie entscheiden, wie viel mitreist - Ihr Name und Ihre Daten kommen nur hinein, wenn Ihr Profil dem zustimmt, lizenzierte Grafiken bleiben außen vor, sofern Sie sie nicht einschließen, und wer eine Datei mit einem Werkzeug öffnet, wird gefragt, ob er ihm vertraut, bevor es laufen darf. Siehe [Ihre Arbeit teilen](/info/using.html#sharing-your-work).

## Können zwei Personen ohne Internet am selben Design arbeiten?

Ja. Eine Person teilt eine Einladung (einen Link, einen QR-Code oder einen kurzen Code), die andere nimmt sie an, und beide Geräte halten dieselbe Sitzung live - samt Anwesenheit und Fokusringen. Das funktioniert in jedem gemeinsamen Netzwerk, auch über einen Handy-Hotspot im Keller, weil kein Server dazwischensteht. Siehe [Zusammenarbeiten](/info/collaborate.html).

## Wo sind die Werkzeuge mit SUSE-Branding geblieben?

Sie liegen bereits in einem separaten, privaten Repository. Ein öffentlicher Klon holt das SUSE-Brand-Pack gar nicht erst, deshalb läuft ein öffentlicher Build mit dem neutralen Profil `lolly-start` - den markenunabhängigen Community-Werkzeugen plus einer leeren Marke, die Sie mit Ihrer eigenen füllen. SUSE betreibt eine eigene Instanz, um seine Marken zu schützen.

## Warum ist es kostenlos? Wo ist der Haken?

**Wir haben Lolly für uns selbst gebaut.** SUSE brauchte Tausende markenkonformer Dateien, jede mit dem eigenen Namen fest darin, erzeugt ohne irgendetwas an fremde Dienste zu geben. Also haben wir ein Werkzeug gebaut, das all das auf dem Gerät erledigt, und es als Open Source veröffentlicht, wie alles andere, was wir machen. Wir pflegen es weiter, weil wir es jeden Tag benutzen. **Es gibt keine Verpflichtung:** Alles hier funktioniert mit uns oder ohne uns.

Diese Grenze zieht die Lizenz, nicht ein Versprechen: Alles, was lokal läuft, ist kostenlos, für immer. Eine veröffentlichte Version ist so lizenziert, dass sie nicht zurückgenommen werden kann, und es gibt keine Contributor-Vereinbarung, die die Arbeit anderer neu lizenzieren könnte. Die vollständige Aussage steht unter [Positionierung](/info/positioning.html).

## Wie viel behält SUSE für sich? (also: wann kommt der Rückzieher)

Die Engine, die Shells, die Schemas und die markenunabhängigen Werkzeuge sind Open Source; privat bleiben die Marken von SUSE und die gebrandeten Werkzeuge, und die sind bereits herausgetrennt. Die öffentliche Instanz unter [lolly.tools](https://lolly.tools) läuft mit der leeren Marke.

Die Grenze ist strukturell, nicht bloß versprochen. Jede veröffentlichte Version ist Open Source und lässt sich nicht zurückziehen, es gibt keine Contributor-Vereinbarung, die die Arbeit anderer neu lizenzieren könnte, und zurückgehalten wird allein die Marke. Als ein anderes Unternehmen 2023 die Quellen seines Enterprise-Linux schloss, hat SUSE [OpenELA](https://openela.org) mitgegründet, um diesen Code offen zu halten - dieselbe Haltung erbt dieses Projekt.

Zur vollen Offenlegung: SUSE baut *sehr wohl* interne Werkzeuge, um Lolly in die eigenen IT-Systeme einzubinden - das betrifft den internen Aufbau bei SUSE, nicht öffentliche gegenüber privater Entwicklung. Lolly soll außerdem über den [Open Build Service](https://openbuildservice.org/) gebaut werden, mit sicheren Supply-Chain-Artefakten aus der [SUSE Application Collection](https://apps.rancher.io/applications).

## Welche Geschmacksrichtung hat dieses Lolly-Logo?

Die einen sagen Limette, die anderen Minze und manchmal Apfel: Lolly bringt die Süße, den Geschmack machen Sie!
