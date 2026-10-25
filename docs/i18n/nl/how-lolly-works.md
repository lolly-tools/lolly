# Hoe Lolly werkt

Een Lolly-tool bevat de regels voor één soort bestand: de lay-out, de typografie, de kleuren en welke delen anderen mogen wijzigen. Jij, een collega, een script of een AI-agent vult de velden in, en elk bestand komt goed uit. Deze pagina laat zien wie wat doet, en de vier routes van een tool naar een afgerond bestand.

## Eén tool, jouw regels, veel bestanden

De merkregels zitten in de tool, niet in elk bestand dat hij maakt. Krijg de tool één keer goed en elke uitvoer erft dezelfde typografie, kleur en witruimte, of het nu één kaart is of een spreadsheet met rijen in een tiental talen.

![Een woordmerktool met één ingevuld veld: typografie, kleur en witruimte werden vastgelegd toen de tool werd gemaakt](/info/shots/aud-rules-in-the-tool.svg)

Wie het honderdste bestand maakt, typt alleen de woorden. Hoe je het werk controleert, en wie dat doet, blijft jouw beslissing. Lolly maakt wat controle verdient kleiner, en het volgende bestand sneller te maken.

## Wie raakt een tool aan

Volg één campagnekaart door een organisatie en er verschijnen drie paar handen. Elk bouwt voort op het vorige.

![Een ontwerper stelt de regels één keer in een tool in; een ontwikkelaar draait hem vanuit een script en iedereen kan de velden invullen; beiden maken afgeronde bestanden](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **Een ontwerper stelt de regels in.** Die legt de kaart in Design uit met de typografie en kleuren van het merk, en kiest dan welke velden open blijven. Dat gebeurt één keer, zodat niemand de kaart nog met de hand lokaliseert.
- <!--i:code--> **Een ontwikkelaar schaalt de tool op.** Dezelfde tool draait in een nachtelijk script via de opdrachtregel, zodat een verse grafiek of een nieuwe taalversie aankomt zonder dat iemand het ontwerp heropent.
- <!--i:people--> **Iedereen vult hem in.** Een verkoper in het vliegtuig, zonder netwerk en zonder ontwerpopleiding, opent de tool en maakt de kaart voor de vergadering van morgen.
:::

De verse grafiek in de stap van de ontwikkelaar is een render zoals deze, gemaakt van een gegevensstring en een paar instellingen zonder dat iemand een ontwerpbestand opent:

![Een gestapelde vlakgrafiek met titel, de drie reeksen in banden in een koel palet, met assen, legenda en titel allemaal door de sjabloon geplaatst in plaats van met de hand](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

De makkelijke minuut van de verkoper is alleen mogelijk dankzij de zorg van de ontwerper en het script van de ontwikkelaar. Elke rol werkt met dezelfde tool, in plaats van met een apart product.

## Vier routes naar een bestand

Elke route draait dezelfde engine op dezelfde tool, dus het bestand dat een script maakt komt overeen met wat je in de app bekijkt.

![URL-parameters en opdrachtregelargumenten worden hetzelfde invoermodel, uitgevoerd door één gedeelde runtime en exportbrug](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **In de app, één tegelijk.** Open een tool, vul de velden in en druk op **Export**. [Maak je eerste bestand](/info/make-something.html) leidt je door één.
- <!--i:layers--> **In de app, veel tegelijk.** [Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) neemt een geplakte of geïmporteerde tabel en rendert één afgerond bestand per rij.
- <!--i:cpu--> **Vanuit een script of een AI-agent.** De [CLI](/info/cli.html) draait een tool headless, en met de [MCP-server](/info/mcp.html) kan een agent tools ontdekken en draaien. Een link naar een tool draagt ook zijn invoer, dus een link is een volledig verzoek.
- <!--i:server--> **Via de server van je organisatie.** [Lolly Work](/info/organisation.html) rendert op de server onder de aanmelding en het toolbeleid van je organisatie, houdt jobs bij die hervat kunnen worden en bewaart de uitvoer voor download of goedgekeurde bezorging.

Welke route een job kan gebruiken hangt af van de formaten van de tool en wat de host kan: sommige formaten hebben een browser nodig, dus de opdrachtregel geeft ze door aan een browserlaag. [Render with the CLI](/info/cli-rendering.html) noemt welke formaten waar renderen.

## Wat waar draait

Maken, bewerken en exporteren draaien op je apparaat, zonder account. Een functie die een server nodig heeft, zoals Sync of een bestand naar een gekoppelde dienst sturen, verbindt alleen wanneer je die functie gebruikt. Met Lolly Work gebruiken gedeelde projecten, live teambewerking, goedkeuringen en serverjobs de server van je organisatie. [Wat waar draait](/info/compare.html#what-runs-where) zet de twee delen naast elkaar.

## Lees hierna

- [Maak je eerste bestand](/info/make-something.html), om het nu te proberen.
- [Start](/info/quickstart.html), om je eigen design system erin te zetten.
- [Automatiseren](/info/builders.html), voor de opdrachtregel, links en agents.
- [Lolly-architectuur](/info/overview.html), voor bijdragers: de engine, de shells en de regels die ze samenhouden.
