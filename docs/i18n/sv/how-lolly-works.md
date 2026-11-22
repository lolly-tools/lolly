# Så fungerar Lolly

Ett Lolly-verktyg innehåller reglerna för en sorts fil: layout, typografi, färger och vilka delar andra får ändra. Du, en kollega, ett skript eller en AI-agent fyller i fälten, och varje fil följer reglerna.

<!--i:eti-repeat-->
## Ett verktyg, dina regler, många filer

Varumärkesreglerna finns i verktyget. Ställ in verktyget en gång så får varje resultat samma typografi, färg och avstånd, från ett enda kort till ett kalkylblad med rader på ett dussin språk.

![Ett ordmärkesverktyg med ett ifyllt fält: typografi, färg och avstånd bestämdes när verktyget skapades](/info/shots/aud-rules-in-the-tool.svg)

Den som skapar den hundrade filen skriver bara orden. Du bestämmer hur arbetet kontrolleras och vem som kontrollerar det. Lolly ger mindre att kontrollera och gör nästa fil snabbare att skapa.

<!--i:eti-users-->
## Vem använder ett verktyg

Tre roller i en organisation arbetar med ett och samma kampanjkort.

![En designer ställer in reglerna en gång i ett verktyg; en utvecklare kör det från ett skript och vem som helst kan fylla i fälten; båda ger färdiga filer](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **En designer bestämmer reglerna.** Designern gör kortets layout i Lolly Design med varumärkets typografi och färger och väljer sedan vilka fält som ska vara öppna. Det görs en gång, så ingen behöver lokalisera kortet manuellt igen.
- <!--i:code--> **En utvecklare skalar upp verktyget.** Samma verktyg körs i ett nattligt skript via kommandoraden. Ett nytt diagram eller en ny språkversion skapas utan att någon öppnar designen igen.
- <!--i:people--> **Vem som helst fyller i.** En säljare på ett flygplan, utan nätverk och utan designutbildning, öppnar verktyget och gör kortet till morgondagens möte.
:::

Utvecklarens nya diagram är en rendering som den här, skapad från en datasträng och några inställningar:

![Ett staplat ytdiagram med rubrik och tre serier som band i en kall palett, där axlar, teckenförklaring och titel placerats av mallen i stället för för hand](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Att säljaren blir klar på en minut bygger på designerns regler och utvecklarens skript. Alla roller arbetar med samma verktyg.

<!--i:eti-train-->
## Fyra vägar till en fil

Alla vägar kör samma motor med samma verktyg, så filen ett skript skapar motsvarar den du förhandsvisar i appen.

![URL-parametrar och kommandoradsargument blir samma indatamodell och körs genom en gemensam körmiljö och exportbrygga](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **I appen, en i taget.** Öppna ett verktyg, fyll i fälten och tryck på **Export**. [Skapa din första fil](/info/make-something.html) visar hur du gör.
- <!--i:layers--> **I appen, många på en gång.** [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) tar en inklistrad eller importerad tabell och renderar en färdig fil per rad.
- <!--i:cpu--> **Från ett skript eller en AI-agent.** [CLI](/info/cli.html) kör ett verktyg utan grafiskt gränssnitt, och [MCP-servern](/info/mcp.html) låter en agent hitta och köra verktyg. En länk till ett verktyg innehåller också dess indata, så en länk är en fullständig begäran.
- <!--i:server--> **Via organisationens server.** [Lolly Work](/info/organisation.html) renderar på servern enligt organisationens inloggnings- och verktygspolicy, sparar jobb som kan återupptas och behåller resultatet för nedladdning eller godkänd leverans.

Vilken väg ett jobb kan ta beror på verktygets format och vad värdmiljön klarar av. Vissa format kräver en webbläsare, så kommandoraden lämnar över dem till ett webbläsarlager. [Rendera med CLI](/info/cli-rendering.html) listar vilka format som renderas var.

<!--i:eti-monitor-->
## Vad körs var

Skapande, redigering och export körs på din enhet, utan konto. En funktion som behöver en server, till exempel Sync eller att skicka en fil till en ansluten tjänst, ansluter bara när du använder funktionen. Med Lolly Work använder delade projekt, teamredigering i realtid, godkännanden och serverjobb organisationens server. [Vad körs var](/info/compare.html#what-runs-where) visar de två delarna sida vid sida.

<!--i:eti-graduation-cap-->
## Läs vidare

- [Skapa din första fil](/info/make-something.html) för att prova nu.
- [Kom igång](/info/quickstart.html) för att lägga in ditt eget designsystem.
- [Automatisera](/info/builders.html) för kommandoraden, länkar och agenter.
- [Lollys arkitektur](/info/overview.html) för bidragsgivare: motorn, skalen och reglerna som håller ihop dem.
