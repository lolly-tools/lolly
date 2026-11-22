# Hoe Lolly werkt

Een Lolly-tool bevat de regels voor één soort bestand: de lay-out, de typografie, de kleuren en welke onderdelen anderen mogen wijzigen. Jij, een collega, een script of een AI-agent vult de velden in en elk bestand volgt die regels.

<!--i:eti-repeat-->
## Eén tool, jouw regels, veel bestanden

De merkregels zitten in de tool. Stel de tool één keer in en elke uitvoer krijgt dezelfde typografie, kleur en tussenruimte, van één kaart tot een spreadsheet met rijen in twaalf talen.

![Een woordmerktool met één ingevuld veld: typografie, kleur en tussenruimte zijn vastgelegd toen de tool werd gemaakt](/info/shots/aud-rules-in-the-tool.svg)

Wie het honderdste bestand maakt, typt alleen de woorden. Jij bepaalt hoe het werk wordt gecontroleerd en wie dat doet. Met Lolly hoef je minder te controleren en maak je het volgende bestand sneller.

<!--i:eti-users-->
## Wie met een tool werkt

Drie rollen binnen een organisatie werken aan één campagnekaart.

![Een ontwerper legt de regels eenmalig vast in een tool; een ontwikkelaar voert hem uit via een script en iedereen kan de velden invullen; beide leveren afgeronde bestanden op](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Een ontwerper legt de regels vast.** Die maakt de kaart in Lolly Design met de typografie en kleuren van het merk en kiest vervolgens welke velden openblijven. Dat gebeurt één keer, zodat niemand de kaart nog handmatig hoeft te lokaliseren.
- <!--i:code--> **Een ontwikkelaar schaalt de tool op.** Dezelfde tool draait elke nacht in een script via de opdrachtregel. Een actueel diagram of een nieuwe taalversie verschijnt zonder dat iemand het ontwerp opnieuw opent.
- <!--i:people--> **Iedereen kan hem invullen.** Een verkoper in een vliegtuig, zonder netwerk en zonder ontwerpopleiding, opent de tool en maakt de kaart voor de vergadering van morgen.
:::

Het actuele diagram van de ontwikkelaar is een render zoals deze, gemaakt met een gegevensstring en een paar instellingen:

![Een gestapeld vlakdiagram met een titel en drie reeksen in banden met een koel palet, waarbij assen, legenda en titel door het sjabloon zijn geplaatst in plaats van met de hand](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Dat de verkoper maar een minuut nodig heeft, komt door de regels van de ontwerper en het script van de ontwikkelaar. Elke rol werkt met dezelfde tool.

<!--i:eti-train-->
## Vier routes naar een bestand

Elke route gebruikt dezelfde engine met dezelfde tool, dus het bestand dat een script maakt, komt overeen met het voorbeeld dat je in de app ziet.

![URL-parameters en opdrachtregelargumenten worden hetzelfde invoermodel en gaan door één gedeelde runtime en exportbrug](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **In de app, één tegelijk.** Open een tool, vul de velden in en druk op **Export**. [Je eerste bestand maken](/info/make-something.html) begeleidt je daarbij.
- <!--i:layers--> **In de app, veel tegelijk.** [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) neemt een geplakte of geïmporteerde tabel en rendert één afgerond bestand per rij.
- <!--i:cpu--> **Vanuit een script of een AI-agent.** De [CLI](/info/cli.html) voert een tool zonder grafische interface uit en via de [MCP-server](/info/mcp.html) kan een agent tools ontdekken en uitvoeren. Een link naar een tool bevat ook de invoer, dus een link is een volledige aanvraag.
- <!--i:server--> **Via de server van je organisatie.** [Lolly Work](/info/organisation.html) rendert op de server volgens het aanmeld- en toolbeleid van je organisatie, bewaart taken die hervat kunnen worden en houdt de uitvoer beschikbaar voor downloaden of goedgekeurde bezorging.

Welke route een taak kan gebruiken, hangt af van de formaten van de tool en de mogelijkheden van de host. Sommige formaten hebben een browser nodig, dus de opdrachtregel draagt ze over aan een browserlaag. [Renderen met de CLI](/info/cli-rendering.html) vermeldt welke formaten waar worden gerenderd.

<!--i:eti-monitor-->
## Wat waar draait

Maken, bewerken en exporteren gebeurt op je apparaat, zonder account. Een functie die een server nodig heeft, zoals Sync of een bestand naar een gekoppelde dienst sturen, maakt pas verbinding als je die functie gebruikt. Met Lolly Work gebruiken gedeelde projecten, live teambewerking, goedkeuringen en servertaken de server van je organisatie. [Wat waar draait](/info/compare.html#what-runs-where) zet de twee onderdelen naast elkaar.

<!--i:eti-graduation-cap-->
## Verder lezen

- [Je eerste bestand maken](/info/make-something.html), om het nu te proberen.
- [Beginnen](/info/quickstart.html), om je eigen design system toe te voegen.
- [Automatiseren](/info/builders.html), voor de opdrachtregel, links en agents.
- [De architectuur van Lolly](/info/overview.html), voor bijdragers: de engine, de shells en de regels die ze samenhouden.
