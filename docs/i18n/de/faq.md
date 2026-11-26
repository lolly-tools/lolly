# Fragen & Antworten

Häufig gestellte Fragen, dargestellt als Akkordeon auf `/info/start/faq.html`.

**So pflegen Sie die Inhalte:** Jede `##`-Überschrift unten ist eine Frage. Alles darunter,
bis zur nächsten `##`-Überschrift, ist die Antwort. Antworten verwenden das einfache Markdown der Website:
Trennen Sie Absätze mit einer Leerzeile. Fügen Sie hier Fragen hinzu, entfernen Sie sie oder ordnen Sie sie neu und
führen Sie `pnpm run build:info` (oder `pnpm run dev:web`) erneut aus.
Der Build ignoriert alles vor der ersten `##`-Überschrift (diesen Titel und diese Hinweise).

Die Reihenfolge richtet sich an Neulinge: zuerst der Haken, dann Ihre Dateien, dann das Herunterladen
und Ausführen von Lolly, dann Organisationen und schließlich die Entstehung. Der Anker jeder Frage
wird aus der englischen Frage an derselben Position gebildet, daher behält eine Übersetzung die
englische Reihenfolge bei.

## Warum ist es kostenlos? Wo ist der Haken?

**Wir haben Lolly für uns selbst gebaut.** SUSE brauchte Tausende von Dateien im eigenen Markendesign, ohne dafür etwas an externe Dienste weiterzugeben. Also haben wir ein Tool gebaut, das all das auf dem Gerät erledigt, und es als Open Source veröffentlicht, wie alles andere, das wir entwickeln. Wir pflegen es weiter, weil wir es jeden Tag nutzen. **Es gibt keine Verpflichtung:** Alles hier funktioniert mit oder ohne uns.

Das steht in der Lizenz, nicht in einem Versprechen: Alles, was lokal läuft, ist kostenlos, für immer. Die Lizenz einer veröffentlichten Version lässt sich nicht zurücknehmen. Keine Mitwirkendenvereinbarung könnte die Arbeit anderer unter eine andere Lizenz stellen.

## Wie viel hält SUSE unter Verschluss? (Oder: Wann wird uns der Boden unter den Füßen weggezogen?)

Die Engine, die Shells, die Schemas und die markenunabhängigen Tools sind Open Source. SUSEs Marken und Tools mit SUSE-Markendesign bleiben privat und sind bereits getrennt. Die öffentliche Instanz unter [lolly.tools](https://lolly.tools) läuft mit [Lolly Demo](/info/lolly-demo.html), Lollys eigenem Designsystem.

Hier beruht nichts auf einem Versprechen: Jede veröffentlichte Version bleibt Open Source. Als ein anderes Unternehmen 2023 den Quellcode seines Enterprise Linux nicht mehr offen bereitstellte, gründete SUSE [OpenELA](https://openela.org) mit, um diesen Code offen zu halten. Dieses Projekt folgt derselben Haltung.

SUSE *entwickelt tatsächlich* interne Tools, um Lolly mit den eigenen IT-Systemen zu verbinden. Das ist SUSEs interne Einrichtung, keine Aufteilung in öffentliche und private Entwicklung. Lolly soll außerdem über den [Open Build Service](https://openbuildservice.org/) gebaut werden, mit sicheren Artefakten aus der Software-Lieferkette, die die [SUSE Application Collection](https://apps.rancher.io/applications) bereitstellt.

## Warum der Name „Lolly Tools“?

**Lolly**, weil Freiheit süß ist und weil ein „lolly“ in Australien, Neuseeland und Großbritannien eine Süßigkeit ist.

**Tools**, weil ein Tool stillsteht, bis Sie es zur Hand nehmen. Es läuft nicht, wenn Sie es nicht benutzen, und beobachtet Sie nicht, während Sie es benutzen.

## Warum ist alles grün?

lolly.tools öffnet sich mit [Lolly Demo](/info/lolly-demo.html), Lollys eigenem Beispiel-Designsystem, dessen Hauptfarbe Grün ist. Wechseln Sie unter [Settings → Design systems](/#/settings?focus=design-systems-section) zu **Lolly Starter**, einem leeren Designsystem, oder zu Ihrem eigenen.

## Kann ich meine eigene Marke verwenden?

Ja. **Lolly Design System Setup** (`#/start`) erstellt ein Designsystem aus einer Farbe, einer Datei mit Design-Tokens oder einem fertigen Design. Jedes Tool zeichnet dann mit Ihrem Designsystem. [Start](/info/quickstart.html#put-your-brand-in) führt durch die drei Wege.

Ein Designsystem, das Ihre Organisation oder Ihr Build bereitstellt, ist verwaltet. Es zeigt ein Schloss und bleibt schreibgeschützt. Um es zu ändern, erstellen Sie eine bearbeitbare Kopie.

## Wo ist das, was ich gestern erstellt habe?

Wenn Sie **Save as** oder **Save** gedrückt haben, liegt Ihre Arbeit unter **Projects** auf dem Startbildschirm, in dem Browser oder der App, in denen Sie gespeichert haben. Wenn Sie nur **Download** gedrückt haben, liegt die Datei in den Downloads Ihres Browsers oder Systems, und eine Kopie liegt meist unter **Assets**. Tools, die [während der Arbeit speichern](/info/find-your-work.html#which-tools-save-as-you-work), behalten auch ungespeicherte Arbeit unter **Projects**. [Ihre Arbeit finden und wiederherstellen](/info/find-your-work.html) behandelt jeden Fall.

## Ich habe den Tab geschlossen. Ist meine Arbeit weg?

Gespeicherte Arbeit liegt weiterhin unter **Projects**. Ungespeicherte Arbeit ist weg, außer in den Tools, die während der Arbeit speichern und sie ebenfalls unter **Projects** behalten. Drücken Sie beim nächsten Mal **Save as**, bevor Sie die Ansicht verlassen. Siehe [Wenn Sie den Tab geschlossen oder das Tool verlassen haben](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Kann ich meine Arbeit als Datei statt als Link teilen?

Ja. Wenn ein Link nicht alles mitnehmen kann, etwa eigene Fotos oder langen Text, nennt der Share-Dialog, was fehlen würde, und bietet eine **.lolly**-Datei an. Diese eine Datei enthält das Design, die verwendeten Bilder und, wenn Sie es wählen, das Tool.

Sie entscheiden, wie viel mitkommt. Ihr Name und Ihre Angaben werden nur aufgenommen, wenn Sie dem in Ihrem Profil zugestimmt haben. Lizenzierte Grafiken werden zurückgehalten, sofern Sie sie nicht ausdrücklich einschließen. Wer eine Datei öffnet, die ein Tool enthält, wird gefragt, ob er dem Tool vertraut, bevor es laufen kann. Siehe [Ihre Arbeit teilen](/info/using.html#sharing-your-work).

## Wozu dienen meine Profilangaben?

Ihre Angaben unter **Settings** füllen die Tools vorab aus, die danach fragen, etwa den Namen auf einem Badge. Sie bleiben auf diesem Gerät. Nichts davon kommt in Ihre Werke, sofern Sie dem nicht ausdrücklich zustimmen. Dann werden die ausgewählten Angaben versiegelt eingebettet und nennen Sie als Quelle.

Teilen und Sync senden nur die Inhalte, die Sie auswählen. Auf der Lolly Work-Instanz einer Organisation gehen geteilte Sitzungen und Arbeit, die den Vorgaben der Organisation unterliegt, auch an diesen Server. Siehe [Datenschutz](/info/privacy.html).

## Wie bekomme ich die Apps für Mobilgeräte oder den Desktop?

Laden Sie sie unter [Lolly installieren](/info/install.html) herunter. Die Seite listet jeden Build für macOS, Windows, Linux und Android auf und zeigt, wie Sie die heruntergeladene Datei prüfen. Für iPhone und iPad gibt es **Lolly Tools** im App Store. [Der Abschnitt zu iPhone und iPad](/info/install.html#iphone-and-ipad) enthält den Link.

Alle können auch eine eigene Kopie der App bauen und verteilen, mit den Tools und Einstellungen, die ihre Zielgruppe braucht. Die [Build-Anleitung](/info/build-guide.html) zeigt, wie das geht.

## Lolly meldet, dass WebGPU erforderlich ist. Was kann ich tun?

Die Web-App zeichnet mit WebGPU, einer Grafikfunktion aktueller Browser, und prüft vor dem Öffnen eines Tools, ob WebGPU verfügbar ist. Versuchen Sie diese Schritte der Reihe nach:

1. Aktualisieren Sie Ihren Browser auf die aktuelle Version.
2. Schalten Sie in den Einstellungen des Browsers die Grafik- oder Hardwarebeschleunigung ein und starten Sie den Browser neu.
3. Probieren Sie einen getesteten Browser: [Unterstützte Umgebungen](/info/supported-environments.html) listet sie auf.
4. Auf einem Mac, iPhone oder iPad [installieren Sie stattdessen die App](/info/install.html).

## Kann Lolly meine Dateien aus Figma, Penpot, Illustrator oder InDesign bearbeiten und rendern?

Ja. Öffnen Sie das Tool **Design** und klicken Sie auf **Import a design**: Es akzeptiert eine native Figma-Datei **.fig** (Save local copy), einen Penpot-Export **.penpot**, eine Illustrator-Datei **.ai** oder **.pdf**, eine InDesign-Datei **.idml** oder **.indd**, ein Affinity-Dokument, eine Photoshop-Datei **.psd**, eine PowerPoint-Datei **.pptx**, eine CAD-Datei **.dxf** oder **jedes SVG** ([alle lesbaren Formate](/info/design-import.html#what-comes-in-from-each-app)). Sie brauchen weder ein Konto noch ein Plugin noch eine Lizenz für eine Design-App.

![Die offene Arbeitsfläche von Lolly Design - Import a design befindet sich im Lolly-Menü der Werkzeugleiste](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Ebenen kommen als bearbeitbare Boxen an. Text bleibt änderbar, Formen bleiben Formen, und Bilder werden in Ihre Bibliothek aufgenommen. Sobald das Layout gespeichert ist, kann **Share with rules** daraus ein Tool machen, das alle mit Lolly neu befüllen können. Siehe [Ein Design importieren](/info/design-import.html).

## Können zwei Personen ohne Internet am selben Design arbeiten?

Ja. Eine Person teilt eine Einladung (einen Link, einen QR-Code oder einen Kurzcode), und die andere nimmt sie an. Beide Geräte halten dann dieselbe Sitzung live, mit Anwesenheitsanzeigen und Fokusringen. Das funktioniert in jedem gemeinsamen Netzwerk, auch über einen Smartphone-Hotspot, weil kein Server dazwischenliegt. Siehe [Zusammenarbeiten](/info/collaborate.html). Für Kolleginnen und Kollegen in verschiedenen Netzwerken bietet die Lolly Work-Instanz einer Organisation authentifizierte Zusammenarbeit.

## Was sind Feature-Flags?

Feature-Flags schalten Teile von Lolly ein oder aus. Bei eigenständiger Nutzung wählen Sie Ihre persönlichen Einstellungen. Eine Organisation, die Lolly Work verwendet, kann in ihrer Richtlinie Standardwerte festlegen oder ausgewählte Schalter ausblenden. Verwaltete Steuerelemente sind gekennzeichnet. Siehe [Lolly in Ihrer Organisation verwenden](/info/organisation.html).

![Persönliche Feature-Flags in der eigenständigen App; die Richtlinie der Organisation kann ausgewählte Schalter steuern](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Was unterscheidet Utilities von Tools?

Ein Utility erledigt eine schnelle Aufgabe an einer Datei, die Sie bereits haben, etwa ein PDF komprimieren, ein Foto umwandeln oder versteckte Daten entfernen. Viele laufen auf Ihrem Gerät, ohne etwas hochzuladen. Utilities halten Aufgaben in Lolly, die Menschen sonst meist irgendeiner Website überlassen. Einen Vertrag zu komprimieren, Urlaubsfotos mit noch enthaltenen Standortdaten umzuwandeln oder ein Token in einen Online-Formatierer einzufügen, sollte nicht bedeuten, die Datei einer Website deren Aufbewahrungsdauer, geltende Rechtsordnung und Geschäftsmodell Sie nicht kennen zu übergeben. [Lolly Utilities](/info/utilities.html) listet sie auf, und [Der Tausch, dem wir nie zugestimmt haben](/info/status-quo.html) erzählt die Geschichte dahinter.

![Die Utilities-Ansicht: Lolly Strip Hidden Data, Compress PDF, Convert Image und die anderen Aufgaben auf dem Gerät, alle an einem Ort](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Kann unsere Organisation SSO, gemeinsame Projekte und Freigaben nutzen?

Ja, mit **Lolly Work**, dem Organisationsserver desselben Open-Source-Projekts. Er läuft separat und ergänzt Single Sign-on über Ihren Identitätsanbieter, SCIM-Bereitstellung, Gruppenberechtigungen, gemeinsame Projekte und Assets, Live-Zusammenarbeit, Freigaben und Audit-Protokolle. Die App für den Alltag funktioniert weiterhin eigenständig.

[Lolly in Ihrer Organisation verwenden](/info/organisation.html) behandelt das Anmelden und Finden gemeinsamer Arbeit. [Bereitstellung](/info/deployment.html#organisation-services-with-lolly-work) behandelt das Einrichten von Lolly Work. Geteilte Inhalte und Aufzeichnungen der Organisation unterliegen den Datenschutz- und Aufbewahrungsrichtlinien dieser Instanz.

## Welche Hürden sind bei der Einführung von Lolly zu erwarten?

Vor allem ändert sich, wie ein Team seine Arbeit erstellt; die Technik ist seltener die Hürde. Ein Team, das einen verbindlich geregelten Satz von Tools möchte, braucht jemanden, der sein Designsystem und die ersten Vorlagen erstellt. Trotzdem können alle vom ersten Tag an eigene Tools in Lolly Design erstellen, ohne git. Bestehende Abläufe funktionieren weiter, auch wenn ihr Ergebnis nicht zum Markendesign passt. Ein sichtbares Ergebnis gut umzustellen und Vorher und Nachher nebeneinander zu zeigen, überzeugt schneller als ein Plan.

[Einführung & Governance](/info/adoption-governance.html) behandelt die Einarbeitung nach Rolle, das Messen eines Pilotprojekts und mögliche Governance-Abläufe.

## Wurde Lolly mit „Vibe Coding“ entwickelt?

Lolly wurde mit KI-gestützter Programmierung, KI-gestützter Recherche und an vielen Stellen KI-gestützten Inhalten entwickelt. Dabei kamen verschiedene Modelle und Anbieter zum Einsatz, darunter auch Unternehmen, die führende Modelle über die öffentliche Cloud anbieten. Ein Mensch entwarf die Architektur, wählte den Code gezielt aus und leitete die Gestaltung der Anwendung.

Eine Sicherheitsmeldung mit hohem oder kritischem Schweregrad in Lollys Abhängigkeiten blockiert CI. Eine noch nicht behebbare Meldung wird nur als genehmigte Ausnahme mit schriftlicher Begründung zurückgestellt. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) listet jede derzeit geltende Ausnahme auf, und die [Versionshinweise](https://github.com/lolly-tools/lolly/releases) nennen die Ausnahmen jeder Version. SECURITY.md erklärt auch, wie Sie eine Schwachstelle melden.

Prüfungen im Build weisen außerdem Formulierungen in Code-Kommentaren, der App und dieser Dokumentation zurück, die maschinell erstellt wirken, damit der Text für alle verständlich bleibt. Eine Nebenwirkung ist, dass ein Detektor möglicherweise schwerer erkennen kann, welchen Text ein Modell geschrieben hat. Das war nicht unser Ziel.

Vor allem baut Lolly auf Jahrzehnten an Open-Source-Arbeit von Fachleuten aus aller Welt auf.

**Offenlegung zum Einsatz generativer KI:**

- **Von LLMs geschriebener Code:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (diese Liste kann wachsen)
- **Recherche mit LLMs:** Gemini 3.1, Fable, Codex Astra
- **Dokumentation:** Sonnet 5
- **Open-Source-Bibliotheken:** Die jeweiligen Autorinnen und Autoren, genannt in der SBOM, in Kommentaren und Dateiköpfen

Diese Liste enthält keine Modelle, die direkt in Lolly eingebunden sind.

**Menschliche Beiträge:**
- **Ideen, Prüfung und Feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, die Penpot Community, Tim Hildred (Liste nicht vollständig)
- **Architektur, Art Direction & Aufräumen von KI-Müll:** Andy Fitzsimon

## Wo sind die Tools im SUSE-Design geblieben?

Sie liegen in einem separaten, privaten Repository. Ein öffentlicher Klon lädt das SUSE-Markenpaket nicht mit, daher verwendet ein daraus erstellter Build das neutrale Profil `lolly-start`, sofern Sie kein anderes wählen. Dieses Profil enthält die markenunabhängigen Community-Tools und eine leere Marke, die Sie mit Ihrer eigenen füllen. [lolly.tools](https://lolly.tools) wird mit dem Profil `lolly-demo` erstellt und öffnet sich in [Lolly Demo](/info/lolly-demo.html), Lollys eigenem Designsystem. SUSE betreibt eine eigene Instanz, um seine Marken zu schützen.

## Wonach schmeckt das Lolly-Logo?

Manche sagen Limette, andere Minze und manchmal Apfel. Lolly bringt die Süße mit, und Sie bestimmen den Geschmack.

## Was versteht Lolly unter Inhaltssouveränität?

Die Kontrolle darüber, wie Ihre Inhalte erstellt, verwaltet, gespeichert und zwischen den von Ihnen gewählten Systemen bewegt werden. Lolly unterstützt die lokale Produktion, bearbeitbare Arbeit und portable Tools. Lolly Work ergänzt gemeinsam genutzte Dienste unter der Kontrolle der Organisation. Die Lizenzen der Quellen, verfügbare Abhängigkeiten und die Datenflüsse des Arbeitsablaufs bleiben dabei relevant. [Was ist Inhaltssouveränität?](/info/content-sovereignty.html) erklärt jede Kontrollmöglichkeit und ihre Grenzen.

## Können wir unser bestehendes DAM behalten?

Ja. Ein unterstütztes DAM kann das führende System bleiben, während Lolly Work ausgewählte Assets mit Lolly-Tools verbindet. Der Zugriff auf die Quelle, erlaubte Änderungen, Nutzungsrechte und die Freigabe der fertigen Ausgabe sind getrennte Entscheidungen. [Lolly mit Ihrem bestehenden DAM verwenden](/info/use-with-dam.html) erklärt das Zusammenspiel, und [SUSEs Erfahrungen mit Brandfolder](/info/suse-brandfolder.html) dokumentiert die erfolgreiche Nutzung während der Einführung.
