# Lolly och renderings-API:er

_Senast kontrollerad: 5 november 2026._

Om du genererar bilder från mallar genom ett API i dag säger den här sidan vad som ändras om du kör den produktionen själv: på din egen enhet, i CI eller på en server du styr. [Flytta från ett värdbaserat renderings-API](/info/work-move-from-render-api.html) är hur du gör.

## Vad värdbaserade renderings-API:er gör bättre

[Bannerbear](https://www.bannerbear.com/) och [Placid](https://placid.app/) är hanterade tjänster, och det är en verklig fördel. Du skickar en begäran och någon annan kör servrarna, håller dem uppe och hanterar belastningen.

- **Inget att driva.** Ingen server, databas, lagring, uppdateringar eller kapacitetsplanering.
- **En värdbaserad mallredigerare** med färdiga mallar att anpassa.
- **Fler utdatatyper från ett API.** Båda publicerar slutpunkter för video och PDF, och Bannerbear dokumenterar också animerad utdata, WebP och AVIF, skärmbilder och AI-borttagning av bakgrund.
- **Egna integrationer och eget stöd.**

Om det är det upplägg du vill ha är de tjänsterna ett gott val.

## Vad egen drift ger dig

- **Ditt innehåll stannar i dina system.** Indata, tillgångar och utdata ligger på infrastruktur du valt. Rendering på en enhet eller i CI behöver ingen tjänst alls.
- **Reglerna bor i verktyget.** Färger, typografi, logotyper och låsta indata kommer från ditt [designsystem](/info/brand-studio.html), så en anropare bara kan ändra det du tillåter. [Lolly Work](/info/compare.html#what-runs-where) tillämpar verktygssynlighet och indatapolicyer på varje begäran.
- **Samma verktyg överallt.** Ett verktyg renderas på en bärbar dator, i ett CI-jobb eller på en server från samma indata, och folk kan redigera samma verktyg i appen.
- **Poster du själv håller.** [Renderingskvitton](/info/work-renders.html#evidence-and-identity), ett granskningsspår och Content Credentials där du konfigurerar en signeringsidentitet.
- **Öppen källkod och ingen mätare.** Du kör koden, och det du betalar för är din egen infrastruktur.

Du tar på dig det arbete som de tjänsterna gör åt dig. En varaktig server behöver en beständig databas och utdatalagring, och verktyg som behöver en webbläsare behöver Chromium-workern. [Install Lolly Work](/info/work-install.html) beskriver båda.

## Så passar jobben ihop

| Jobb | Värdbaserat renderings-API | Lolly |
|---|---|---|
| Fylla en mall från data | API-begäran som anger en mall och dess lager | [URL](/info/url-mode.html), [CLI](/info/cli.html) eller [server-API](/info/work-automation-api.html) som anger ett verktyg och dess indata |
| Många filer från en tabell | Batchar och samlingar | [Batch](/info/batch.html) på din enhet, eller [renderingsbatchar](/info/work-renders.html#batches-with-durable-rows) på en server |
| Vänta på eller polla ett resultat | Polling eller ett synkront alternativ | Varaktiga renderingar som du pollar, eller en omedelbar rendering |
| Anropa en webhook när det är klart | Ja | [Signerade callbacks](/info/work-renders.html) till ursprung du tillåter |
| Dynamisk bild-URL | Ja | [Delningslänkar och `/render`-URL:er](/info/url-mode.html) |
| Redigera en mall | Värdbaserad redigerare | [Design](/info/using.html), på din enhet |
| Agenter | Båda publicerar en MCP-server | [MCP](/info/mcp.html), med en organisationsslutpunkt under en tokens policy på Lolly Work |

Lollys egna utdatatyper listas i [Exporting](/info/exporting.html). På en Work-server i dag gör varaktiga renderingar SVG, PNG, JPG och PDF, och [video stannar på enheten, i CLI och i MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

## Vad som följer med, och vad som inte gör det

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Dina begäranden | Works migrerings-API tar samma form | Samma | Samma |
| Dina mallar | **Importeras** som redigerbara dokument, utom lagertyper utan bekräftat schema | Bara fältnamn och en förhandsvisning. Bygg om varje | Bara fältnamn och en förhandsvisning. Bygg om varje |
| Befintliga dynamiska URL:er | Stöds inte | Stöds inte | Signerade URL:er fortsätter fungera efter ett värdbyte, med din gamla privata token |
| Webhooks | Registrerade webhooks stöds inte | `webhook_url` fungerar | `webhook_success` fungerar |
| WebP- och AVIF-utdata | Nekas vid namn | Erbjuds inte | WebP nekas vid namn |
| Animationer, videor, samlingar, skärmbilder | Finns inte i migrerings-API:et | Finns inte i migrerings-API:et | Finns inte i migrerings-API:et |

Allt detta byggdes utifrån varje leverantörs offentliga dokumentation och har inte körts mot ett skarpt konto. [Flyttguiden](/info/work-move-from-render-api.html#check-it-on-your-own-account) har en kort checklista om du har ett.

Att flytta är inte allt eller inget. Du kan flytta en mall och låta resten stå kvar där de är, och [att lämna Lolly](/info/work-move-from-render-api.html#leave-lolly-too) förblir lika öppet: verktyg är vanliga filer och CLI renderar dem utan server.

## Vem som driver tjänsten

Med Lolly renderar en individ lokalt, eller så kör ett team Lolly Work på sin egen infrastruktur. Att skicka in ett serverjobb skickar dess indata och nödvändiga tillgångar till den instansen, vilket skiljer sig från vägen på enheten.

Bannerbear och Placid är varumärken som tillhör sina ägare. Den här sidan beskriver var produkterna överlappar, utifrån deras offentliga dokumentation, och är inte knuten till någondera.
