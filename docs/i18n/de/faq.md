# Fragen und Antworten

Häufig gestellte Fragen, gerendert als Akkordeon auf `/info/start/faq.html`.

**So wird gepflegt:** Jede `##`-Überschrift unten ist eine Frage; alles darunter
(bis zur nächsten `##`) ist die Antwort. Die Antworten nutzen dasselbe schlanke Markdown wie
der Rest der Website - trennen Sie Absätze mit einer Leerzeile. Fügen Sie hier Fragen hinzu,
entfernen oder sortieren Sie sie um und führen Sie `pnpm run build:info` (oder `pnpm run dev:web`) erneut aus.
Alles oberhalb der ersten `##` (dieser Titel und diese Hinweise) wird beim Build ignoriert.

Die Reihenfolge ist die eines Erstnutzers: zuerst der Haken, dann Ihre Dateien, dann Lolly
bekommen und betreiben, dann Organisationen, dann wie es gebaut wurde. Der Anker jeder Frage
wird aus der englischen Frage an derselben Position gebildet, sodass eine Übersetzung die
englische Reihenfolge behält.

## Warum ist es kostenlos? Wo ist der Haken?

**Wir haben Lolly für uns selbst gebaut.** SUSE brauchte Tausende markenkonformer Dateien, erstellt, ohne irgendetwas an externe Dienste zu geben. Also bauten wir ein Tool, das all das auf dem Gerät erledigt, und veröffentlichten es als Open Source, wie alles andere, was wir machen. Wir pflegen es weiter, weil wir es täglich nutzen. **Es gibt keine Verpflichtung:** Alles hier funktioniert mit uns oder ohne uns.

Diese Linie ist in der Lizenz gezogen, nicht in einem Versprechen: Alles, was lokal läuft, ist kostenlos, für immer. Eine veröffentlichte Version ist so lizenziert, dass sie nicht zurückgenommen werden kann, und es gibt keine Beitragsvereinbarung, die die Arbeit von irgendwem umlizenzieren könnte.

## Wie viel behält SUSE für sich? (also: wann kommt der Rückzieher)

Die Engine, die Shells, die Schemas und die markenunabhängigen Tools sind Open Source. Die Marken von SUSE und markengebundene Tools sind der Teil, der privat bleibt, und sie sind bereits abgetrennt. Die öffentliche Instanz unter [lolly.tools](https://lolly.tools) betreibt [Lolly Demo](/info/lolly-demo.html), Lollys eigenes Designsystem.

Nichts hier beruht auf einem Versprechen: Jede veröffentlichte Version bleibt Open Source, und das Einzige, was zurückgehalten wird, ist die Marke. Als ein anderes Unternehmen 2023 seine Enterprise-Linux-Quellen schloss, gründete SUSE [OpenELA](https://openela.org) mit, um diesen Code offen zu halten, dieselbe Haltung, die dieses Projekt erbt.

Volle Offenlegung: SUSE *baut* interne Werkzeuge, um Lolly mit den eigenen IT-Systemen zu verbinden. Das ist der interne Aufbau von SUSE, keine Trennung zwischen öffentlicher und privater Entwicklung. Lolly soll außerdem über den [Open Build Service](https://openbuildservice.org/) gebaut werden, mit sicheren Lieferketten-Artefakten aus der [SUSE Application Collection](https://apps.rancher.io/applications).

## Warum der Name "Lolly Tools"?

**Lolly**, weil Freiheit süß ist und weil "lolly" in Australien, Neuseeland und Großbritannien eine Süßigkeit bedeutet.

**Tools**, weil ein Werkzeug still daliegt, bis Sie es in die Hand nehmen. Es läuft nicht, wenn Sie es nicht benutzen, und es beobachtet Sie nicht, während Sie es benutzen.

## Warum ist alles grün?

lolly.tools öffnet sich in [Lolly Demo](/info/lolly-demo.html), Lollys eigenem Beispiel-Designsystem, und seine Leitfarbe ist Grün. Das ist ein Beispiel, keine Regel. Wechseln Sie zu **Lolly Starter**, einem leeren Designsystem, oder zu Ihrem eigenen unter [Settings → Design systems](/#/settings?focus=design-systems-section).

## Kann ich meine eigene Marke nutzen?

Ja. **Design System Setup** (`#/start`) baut ein Designsystem aus einer Farbe, einer Design-Tokens-Datei oder einem fertigen Design auf, und jedes Tool zeichnet dann mit Ihrem Designsystem. [Start](/info/quickstart.html#put-your-brand-in) führt durch die drei Wege.

Ein Designsystem, das Ihre Organisation oder Ihr Build liefert, ist verwaltet: Es zeigt ein Schloss und bleibt schreibgeschützt, und Sie können eine bearbeitbare Kopie zum Ändern erstellen.

## Wo ist das, was ich gestern gemacht habe?

Wenn Sie **Save as** oder **Save** gedrückt haben, liegt es in **Projects** auf dem Startbildschirm, in dem Browser oder der App, aus der Sie gespeichert haben. Wenn Sie nur **Download** gedrückt haben, liegt die Datei dort, wo Ihr Browser oder System Downloads ablegt, und meist liegt eine Kopie in **Assets**. Tools, die [während der Arbeit speichern](/info/find-your-work.html#which-tools-save-as-you-work), behalten ungespeicherte Arbeit ebenfalls in **Projects**. [Ihre Arbeit finden und wiederherstellen](/info/find-your-work.html) behandelt jeden Fall.

## Ich habe den Tab geschlossen. Ist meine Arbeit weg?

Gespeicherte Arbeit ist weiterhin in **Projekte**. Nicht gespeicherte Arbeit ist weg, außer in den Tools, die während der Arbeit speichern, welche sie ebenfalls in **Projekte** halten. Drücken Sie beim nächsten Mal **Speichern unter**, bevor Sie das Tool verlassen. Siehe [Wenn Sie den Tab geschlossen oder das Tool verlassen haben](/info/find-your-work.html#if-you-closed-the-tab-or-left-the-tool).

## Kann ich meine Arbeit als Datei statt als Link teilen?

Ja. Wenn ein Link nicht alles tragen kann, etwa Ihre eigenen Fotos oder langen Text, sagt der Share-Dialog, was fehlen würde, und bietet stattdessen eine **.lolly**-Datei an: eine Datei mit dem Design, den Bildern, die es nutzt, und, wenn Sie wollen, dem Tool selbst.

Sie entscheiden, wie viel mitreist. Ihr Name und Ihre Angaben kommen nur hinein, wenn Ihr Profil zustimmt, und lizenzierte Kunst wird zurückgehalten, sofern Sie nicht wählen, die Kunst einzuschließen. Wer eine Datei öffnet, die ein Tool trägt, wird gefragt, ob er dem Tool vertraut, bevor es laufen kann. Siehe [Ihre Arbeit teilen](/info/using.html#sharing-your-work).

## Was machen meine Profilangaben?

Ihre Angaben in **Settings** füllen die Tools vor, die danach fragen, etwa einen Namen auf einem Namensschild. Sie bleiben auf diesem Gerät. Wenn Sie zusätzlich die Zustimmung einschalten, werden die Angaben, die Sie wählen, in das eingebettet, was Sie erstellen, und nennen Sie als Quelle. Nichts wird aufgenommen, solange Sie nicht wählen, Ihre Angaben aufzunehmen.

Teilen und Sync senden nur die Inhalte, die Sie wählen. Auf der Lolly-Work-Instanz einer Organisation gehen auch geteilte Sitzungen und gesteuerte Arbeit an diesen Server. Siehe [Datenschutz](/info/privacy.html).

## Wie bekomme ich die Apps für Mobilgeräte oder den Desktop?

Laden Sie sie über [Lolly installieren](/info/install.html) herunter. Die Seite listet jeden Build für macOS, Windows, Linux und Android auf und zeigt, wie Sie die heruntergeladene Datei prüfen. iPhone und iPad erhalten **Lolly Tools** im App Store; [der Abschnitt zu iPhone und iPad](/info/install.html#iphone-and-ipad) hat den Link.

Jeder kann auch eine eigene Kopie der App bauen und weitergeben, mit den Tools und Einstellungen, die die eigene Zielgruppe braucht. Der [Build-Leitfaden](/info/build-guide.html) zeigt, wie.

## Lolly sagt, es braucht WebGPU. Was kann ich tun?

Die Web-App zeichnet mit WebGPU, einer Grafikfunktion aktueller Browser, und prüft sie, bevor sie ein Tool öffnet. Probieren Sie der Reihe nach:

1. Aktualisieren Sie Ihren Browser auf die aktuelle Version.
2. Schalten Sie die Grafik- oder Hardwarebeschleunigung in den Einstellungen des Browsers ein und starten Sie den Browser neu.
3. Probieren Sie einen getesteten Browser: [Unterstützte Umgebungen](/info/supported-environments.html) listet sie auf.
4. Auf einem Mac, iPhone oder iPad [installieren Sie stattdessen die App](/info/install.html).

## Kann Lolly meine Figma-, Penpot-, Illustrator- oder InDesign-Dateien bearbeiten und rendern?

Ja. Öffnen Sie **Design** und klicken Sie auf **Import a design**: Es akzeptiert eine native Figma-**.fig** (Save local copy), einen Penpot-Export **.penpot**, eine Illustrator-**.ai** oder **.pdf**, eine InDesign-**.idml** (File → Export → InDesign Markup) oder **jede SVG**. Sie brauchen kein Konto, kein Plug-in und keine Lizenz für eine Design-App.

![Designs offene Zeichenfläche - Ein Design importieren befindet sich im Lolly-Menü der Werkzeugleiste](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Fz%3D17ZTfS8MwEMf_mryO5NZ288GHrdqJv1CUvWdtOgppMtJMNv96yaV1iRNEQRBZoblwab53l0-uq915bXgrCOSDpf3LzgANnQ4eI0rrPJn7Gh9cd0sE8lIryxtFIFfatFx6L4F0Mi-11GbUiZYr25QjK3bW-S8I5MnUbRXKCkMgb5uqki6JFFU7rjoXYsSgT8GaLebKZSeGAPkUYypMHp80DeugYYR4J_U7X4XRkY8dFHuTYEJ-jDWM3qoqsEHo4Y20-xJi-SPVaOfRUuAL1hiZXNrG4gH6M85Z5lTAk8x8DdlnPL8gecVfBIEU6F5v0bbCor3VUu4JpOPCKTCWsPI9rBS107d6QyCfRET_Ac6wX36X6UpX-49Ip1mAlMEPkM6QX20aoSpECLTmpadcazPQ9hPlWxboRndWmFEIG1s4Yp3E3Ts-0f4GbcruWHLzlC0frmfpfbGk82LxmD0vUndSTcvXAoknWBKCz5LDSIdiRHV0D2Tfq1BIvdY42Zim5WZ_-n3_mRvwBg&width=1360&height=850&dpi=192&waitMs=3000&format=svg&walker=1&chrome=1&localize=1&dark=1&filename=design)

Ebenen kommen als bearbeitbare Boxen an: Text bleibt neu tippbar, Formen bleiben Formen, und Bilder landen in Ihrer eigenen Bibliothek. Speichern Sie es, und **Share with rules** kann das Layout in ein Tool verwandeln, das jede und jeder mit Lolly neu ausfüllen kann. Siehe [Ein Design importieren](/info/design-import.html).

## Können zwei Personen ohne Internet am selben Design arbeiten?

Ja. Eine Person teilt eine Einladung als Link, QR-Code oder kurzen Code, und die andere nimmt sie an. Beide Geräte halten dann dieselbe Sitzung live, samt Anwesenheit und Fokusringen. Es funktioniert in jedem gemeinsamen Netzwerk, auch an einem Smartphone-Hotspot in einem Keller, weil kein Server dazwischen steht. Siehe [Zusammenarbeiten](/info/collaborate.html). Für Kolleginnen und Kollegen in verschiedenen Netzwerken bietet die Lolly-Work-Instanz einer Organisation authentifizierte Work-Collabs.

## Was sind die Feature-Flags?

Feature-Flags schalten Teile von Lolly ein oder aus. Bei eigenständiger Nutzung wählen Sie Ihre persönlichen Einstellungen. Eine Organisation, die Lolly Work nutzt, kann Standardwerte setzen oder ausgewählte Schalter nach ihrer Richtlinie ausblenden, und verwaltete Steuerelemente sind gekennzeichnet. Siehe [Lolly in Ihrer Organisation nutzen](/info/organisation.html).

![Persönliche Feature-Flags in der eigenständigen App; die Richtlinie einer Organisation kann ausgewählte Schalter regeln](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dfeature-flags&width=1440&height=1800&dpi=192&waitMs=2000&format=svg&cropSelector=%23feature-flags-section&walker=1&dark=1&filename=pd-feature-flags)

## Was unterscheidet Utilities von Tools?

Ein Utility erledigt eine schnelle Aufgabe an einer Datei, die Sie schon haben, etwa ein PDF komprimieren, ein Foto umwandeln oder versteckte Daten entfernen, und viele laufen auf Ihrem Gerät, ohne dass etwas hochgeladen wird. Sie existieren, damit die Aufgaben, die Leute sonst einer beliebigen Website überlassen, in Lolly bleiben. Einen Vertrag zu komprimieren, Urlaubsfotos mit noch darin steckendem Standort umzuwandeln oder ein Token in einen Online-Formatierer einzufügen, sollte nicht heißen, die Datei einer Website mit unbekannter Aufbewahrung, Rechtsordnung und unbekanntem Geschäftsmodell zu geben. [Utilities](/info/utilities.html) listet sie auf, und [Der Handel, dem wir nie zugestimmt haben](/info/status-quo.html) erzählt die Geschichte dahinter.

![Die Ansicht Utilities: Strip Hidden Data, Compress PDF, Convert Image und die anderen Aufgaben auf dem Gerät, alle an einem Ort](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=use-utilities&try=1)

## Kann unsere Organisation SSO, gemeinsame Projekte und Freigaben nutzen?

Ja, mit **Lolly Work**, dem Organisationsserver desselben Open-Source-Projekts. Er läuft getrennt und ergänzt Single Sign-on über Ihren Identitätsanbieter, SCIM-Bereitstellung, Gruppenberechtigungen, gemeinsame Projekte und Assets, Live-Work-Collabs, Freigaben und Audit-Aufzeichnungen. Die Alltags-App funktioniert weiterhin allein.

[Lolly in Ihrer Organisation nutzen](/info/organisation.html) behandelt Anmeldung und das Finden gemeinsamer Arbeit, und [Bereitstellung](/info/deployment.html#organisation-services-with-lolly-work) behandelt die Einrichtung. Gemeinsame Inhalte und Organisationsaufzeichnungen folgen den Datenschutz- und Aufbewahrungsrichtlinien dieser Instanz.

## Mit welchen Hürden muss ich bei der Einführung von Lolly rechnen?

Meist ändert sich etwas auf der erzeugenden Seite, nicht in der Technik. Ein Team, das einen gesteuerten Satz von Tools will, braucht jemanden, der sein Designsystem und die ersten Vorlagen verfasst, obwohl jede und jeder schon am ersten Tag in Design eigene Tools erstellen kann, ganz ohne Git. Und bestehende Prozesse laufen weiter, auch wenn ihre Ausgabe nicht zur Marke passt; ein gut umgestelltes sichtbares Ergebnis, vorher und nachher nebeneinander, überzeugt daher schneller als ein Plan.

[Adoption & Governance](/info/adoption-governance.html) behandelt das Onboarding nach Rolle, wie Sie einen Pilot messen und wie ein Governance-Prozess aussehen kann.

## Wurde Lolly "vibe coded"?

Lolly wurde mit KI-gestütztem Programmieren, KI-gestützter Recherche und an vielen Stellen KI-gestützten Inhalten entwickelt, mit einer Mischung aus Modellen und Anbietern, darunter solche von Frontier-Unternehmen der Public Cloud. Ein Mensch hat die Architektur geschaffen, den Code mit Absicht kuratiert und das Erlebnis art-dirigiert.

Ein hoher oder kritischer Hinweis in den Abhängigkeiten von Lolly blockiert die CI. Ein Hinweis, der noch nicht behoben werden kann, wird nur als genehmigte Ausnahme mit schriftlicher Begründung zurückgestellt. [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md#dependency-audit-exceptions) listet jede heute gehaltene Ausnahme auf, und die [Release Notes](https://github.com/lolly-tools/lolly/releases) listen die auf, die jedes Release trägt. SECURITY.md sagt auch, wie Sie eine Schwachstelle melden.

Prüfungen im Build weisen außerdem Formulierungen zurück, die in Code-Kommentaren, in der App und in diesen Dokumenten maschinengemacht wirken, um den Text für alle Leserinnen und Leser schlicht zu halten. Ein Nebeneffekt ist, dass ein Detektor es schwerer finden kann zu erkennen, welchen Text ein Modell geschrieben hat. Das war nicht unsere Absicht.

Vor allem steht Lolly auf den Schultern von Jahrzehnten Open-Source-Arbeit von Fachleuten auf der ganzen Welt.

**Offenlegung zu generativer KI:**

- **Von LLMs geschriebener Code:** Opus 4.8, Gemini 3.1, Qwen3-Coder-Next, Codex Sol (diese Liste kann wachsen)
- **LLM-Recherche:** Gemini 3.1, Fable, Codex Astra
- **Dokumentation:** Sonnet 5
- **Open-Source-Bibliotheken:** Ihre jeweiligen Autorinnen und Autoren, ausgewiesen in der SBOM, in Kommentaren und Dateiköpfen

Diese Liste umfasst keine Modelle, die fest in Lolly eingebunden sind.

**Menschliche Beiträge:**
- **Ideenfindung, Review und Feedback:** Ravan Naidoo, Matthias Eckermann, Kelly Andrews, Ryan Kleeman, Peter Chamalian, die Penpot Community, Tim Hildred (Liste nicht vollständig)
- **Architektur, Art Direction und Slop Janitor:** Andy Fitzsimon

## Wo sind die Werkzeuge mit SUSE-Branding geblieben?

Sie liegen in einem separaten, privaten Repository. Ein öffentlicher Clone holt das SUSE-Marken-Paket gar nicht, sodass ein Build daraus das neutrale Profil `lolly-start` nutzt, sofern Sie kein anderes wählen: die markenunabhängigen Community-Tools plus eine leere Marke, die Sie mit Ihrer eigenen füllen. [lolly.tools](https://lolly.tools) wird mit dem Profil `lolly-demo` gebaut und öffnet sich in [Lolly Demo](/info/lolly-demo.html), Lollys eigenem Designsystem. SUSE betreibt eine eigene Instanz, um seine Marken zu schützen.

## Welche Geschmacksrichtung hat dieses Lolly-Logo?

Die einen sagen Limette, die anderen Minze und manchmal Apfel: Lolly bringt die Süße, den Geschmack machen Sie!
