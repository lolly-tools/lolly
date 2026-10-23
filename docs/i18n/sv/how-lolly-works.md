# Så fungerar Lolly

Ett Lolly-verktyg håller reglerna för en sorts fil: layouten, typografin, färgerna och vilka delar andra får ändra. Du, en kollega, ett skript eller en AI-agent fyller i fälten, och varje fil blir rätt. Den här sidan visar vem som gör vad, och de fyra vägarna från ett verktyg till en färdig fil.

## Ett verktyg, dina regler, många filer

Varumärkesreglerna finns i verktyget, inte i varje fil det gör. Få verktyget rätt en gång så ärver varje utdata samma typografi, färg och avstånd, vare sig det är ett kort eller ett kalkylblad med rader på ett dussin språk.

![Ett ordmärkesverktyg med ett fält ifyllt: typografi, färg och avstånd avgjordes när verktyget skapades](/info/shots/aud-rules-in-the-tool.svg)

Personen som gör den hundrade filen skriver bara orden. Hur du kontrollerar arbetet, och vem som gör det, förblir ditt beslut. Lolly gör det som är värt att kontrollera mindre, och nästa fil snabbare att göra.

## Vem som rör ett verktyg

Följ ett kampanjkort genom en organisation så dyker tre par händer upp. Var och en bygger vidare på den förra.

![En designer ställer in reglerna en gång i ett verktyg; en utvecklare kör det från ett skript och vem som helst kan fylla i dess fält; båda gör färdiga filer](/info/diagrams/concepts/asset-relay.svg)

::: timeline
- <!--i:pentool--> **En designer sätter reglerna.** Hen lägger ut kortet i Design med varumärkets typografi och färger och väljer sedan vilka fält som förblir öppna. Det görs en gång, så ingen behöver lokalisera kortet för hand igen.
- <!--i:code--> **En utvecklare skalar upp verktyget.** Samma verktyg körs i ett nattligt skript via kommandoraden, så att ett nytt diagram eller en ny språkversion dyker upp utan att någon öppnar designen igen.
- <!--i:people--> **Vem som helst fyller i det.** En säljare på ett flygplan, utan nätverk och utan designutbildning, öppnar verktyget och gör kortet till morgondagens möte.
:::

Det nya diagrammet i utvecklarens steg är en rendering som den här, gjord av en datasträng och några inställningar utan att någon öppnar en designfil:

![Ett staplat ytdiagram med titel, med sina tre serier i en sval palett, där axlar, förklaring och titel placerats av mallen i stället för för hand](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

Säljarens enkla minut är bara möjlig tack vare designerns omsorg och utvecklarens skript. Varje roll arbetar med samma verktyg, i stället för en separat produkt var.

## Fyra vägar till en fil

Varje väg kör samma motor på samma verktyg, så filen som ett skript gör matchar den du förhandsgranskar i appen.

![URL-parametrar och kommandoradsargument blir samma indatamodell, körs genom en gemensam körmiljö och exportbrygga](/info/diagrams/concepts/one-render-path.svg)

- <!--i:people--> **I appen, en i taget.** Öppna ett verktyg, fyll i fälten och tryck på **Export**. [Gör din första fil](/info/make-something.html) tar dig igenom en.
- <!--i:layers--> **I appen, många på en gång.** [Batch](/info/batch.html#make-many-versions-of-one-design) (`#/batch`) tar en inklistrad eller importerad tabell och renderar en färdig fil per rad.
- <!--i:cpu--> **Från ett skript eller en AI-agent.** [CLI](/info/cli.html) kör ett verktyg utan gränssnitt, och [MCP-servern](/info/mcp.html) låter en agent upptäcka och köra verktyg. En länk till ett verktyg bär också dess indata, så en länk är en komplett begäran.
- <!--i:server--> **Via din organisations server.** [Lolly Work](/info/organisation.html) renderar på servern under din organisations inloggning och verktygspolicy, behåller jobb som kan återupptas och håller utdatan för nedladdning eller godkänd leverans.

Vilken väg ett jobb kan använda beror på verktygets format och vad värden klarar: vissa format kräver en webbläsare, så kommandoraden lämnar över dem till en webbläsarnivå. [Rendera med CLI](/info/cli-rendering.html) listar vilka format som renderas var.

## Vad som körs var

Att skapa, redigera och exportera sker på din enhet, utan konto. En funktion som kräver en server, som Sync eller att skicka en fil till en ansluten tjänst, ansluter bara när du använder den funktionen. Med Lolly Work använder delade projekt, redigering i team i realtid, godkännanden och serverjobb din organisations server. [Vad som körs var](/info/compare.html#what-runs-where) ställer de två delarna bredvid varandra.

## Läs vidare

- [Gör din första fil](/info/make-something.html), för att prova det nu.
- [Kom igång](/info/quickstart.html), för att lägga in ditt eget designsystem.
- [Automatisera](/info/builders.html), för kommandoraden, länkar och agenter.
- [Lollys arkitektur](/info/overview.html), för bidragsgivare: motorn, skalen och reglerna som håller ihop dem.
