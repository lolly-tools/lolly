# Lolly och renderings-API:er

_Senast kontrollerat: 5 november 2026._

Om du genererar bilder från mallar via ett API säger den här sidan vad som ändras när du kör produktionen på din egen enhet, i CI eller på en server du kontrollerar. [Flytta från ett hostat renderings-API](/info/work-move-from-render-api.html) ger stegen.

<!--i:eti-award-->
## Vad hostade renderings-API:er gör bättre

[Bannerbear](https://www.bannerbear.com/) och [Placid](https://placid.app/) är hanterade tjänster: du skickar en begäran och någon annan driver servrarna.

- **Inget att driva.** Ingen server, databas, lagring, uppdatering eller kapacitetsplanering.
- **En hostad mallredigerare** med mallar redo att anpassas.
- **Fler typer av utdata från ett API.** Båda publicerar video- och PDF-slutpunkter, och Bannerbear dokumenterar också animerade utdata, WebP och AVIF, skärmbilder och bakgrundsborttagning med AI.
- **Egna integrationer och egen support.**

Om det är det upplägget du vill ha är de tjänsterna ett bra val.

<!--i:eti-home-->
## Vad egen drift ger dig

- **Ditt innehåll stannar i dina system.** Indata, tillgångar och utdata finns på infrastruktur du har valt. Rendering på en enhet eller i CI behöver ingen tjänst.
- **Reglerna finns i verktyget.** Färger, typsnitt, logotyper och låsta indata kommer från ditt [designsystem](/info/brand-studio.html), så den som anropar kan bara ändra det du tillåter. [Lolly Work](/info/compare.html#what-runs-where) tillämpar verktygssynlighet och indatapolicyer på varje begäran.
- **Samma verktyg överallt.** Ett verktyg renderar från samma indata på en bärbar dator, i ett CI-jobb eller på en server. Människor kan redigera samma verktyg i appen.
- **Dokumentation som du behåller.** [Renderingskvitton](/info/work-renders.html#evidence-and-identity), en granskningslogg och Content Credentials där du konfigurerar en signeringsidentitet.
- **Öppen källkod och ingen förbrukningsdebitering.** Du kör koden och betalar bara för din egen infrastruktur.

Du tar över det arbete som de tjänsterna gör åt dig. En varaktig server behöver en beständig databas och lagring för utdata. Verktyg som behöver en webbläsare behöver Chromium-arbetaren. [Installera Lolly Work](/info/work-install.html) beskriver båda.

<!--i:eti-table-->
## Så motsvarar jobben varandra

| Jobb | Hostat renderings-API | Lolly |
|---|---|---|
| Fyll en mall från data | API-begäran som anger en mall och dess lager | [URL](/info/url-mode.html), [CLI](/info/cli.html) eller [server-API](/info/work-automation-api.html) som anger ett verktyg och dess indata |
| Många filer från en tabell | Batchar och samlingar | [Batch](/info/batch.html) på din enhet eller [renderingsbatchar](/info/work-renders.html#batches-with-durable-rows) på en server |
| Vänta eller polla efter ett resultat | Pollning eller ett synkront alternativ | Beständiga renderingar som du pollar eller en omedelbar rendering |
| Anropa en webhook när jobbet är klart | Ja | [Signerade återanrop](/info/work-renders.html) till ursprung du tillåter |
| Dynamisk bild-URL | Ja | [Delningslänkar och `/render`-URL:er](/info/url-mode.html) |
| Redigera en mall | Hostad redigerare | [Design](/info/using.html), på din enhet |
| Agenter | Båda publicerar en MCP-server | [MCP](/info/mcp.html), med en organisationsslutpunkt som styrs av en tokens policy på Lolly Work |

Lollys egna typer av utdata listas i [Exportera en fil](/info/exporting.html). På en Work-server skapar beständiga renderingar i dag SVG, PNG, JPG och PDF, och [video stannar på enheten, i CLI och i MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

<!--i:eti-folder-move-->
## Vad som följer med och vad som inte gör det

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Dina begäranden | Works migrerings-API tar emot samma struktur | Samma | Samma |
| Dina mallar | **Import** som redigerbara dokument, utom lagertyper utan bekräftat schema | Bara fältnamn och en förhandsvisning. Bygg om var och en | Bara fältnamn och en förhandsvisning. Bygg om var och en |
| Befintliga dynamiska URL:er | Stöds inte | Stöds inte | Signerade URL:er fortsätter fungera efter ett värdbyte, med din gamla privata token |
| Webhooks | Registrerade webhooks stöds inte | `webhook_url` fungerar | `webhook_success` fungerar |
| WebP- och AVIF-utdata | Avvisas när formatet anges | Erbjuds inte | WebP avvisas när formatet anges |
| Animationer, videor, samlingar, skärmbilder | Inte i migrerings-API:et | Inte i migrerings-API:et | Inte i migrerings-API:et |

::: note Byggt utifrån offentlig dokumentation
Detta byggdes utifrån varje leverantörs offentliga dokumentation och har inte körts mot ett aktivt konto. Om du har ett konto finns en kort checklista i [flyttguiden](/info/work-move-from-render-api.html#check-it-on-your-own-account).
:::

Du kan flytta en mall och låta resten vara kvar där de är. [Att lämna Lolly](/info/work-move-from-render-api.html#leave-lolly-too) är lika öppet: verktyg är vanliga filer och CLI renderar dem utan server.

<!--i:eti-building-->
## Vem som driver tjänsten

Med Lolly renderar en enskild person lokalt, eller så kör ett team Lolly Work på sin egen infrastruktur. Ett serverjobb skickar sina indata och nödvändiga tillgångar till den instansen. Vid körning på enheten sker inte det.

Bannerbear och Placid är varumärken som tillhör sina respektive ägare. Den här sidan beskriver var produkterna överlappar utifrån deras offentliga dokumentation och har ingen koppling till någon av dem.
