# Lolly och varumärkesportaler

_Positionering uppdaterad: 31 oktober 2026. Exempel på leverantörsfunktioner kontrollerat: 28 september 2026._

Om din organisation förvarar sina godkända tillgångar i Bynder, Frontify, Marq eller Brandfolder jämför den här sidan portalen med Lolly plus Lolly Work. Den tar upp hur människor hittar varumärkestillgångar och hur de skapar nya filer från dem.

<!--i:eti-folder-shared-->
## Behålla din befintliga portal

Ett befintligt DAM kan fortsätta vara den auktoritativa källan. Lolly Works kataloganslutningar gör en utvald del av dess bibliotek tillgänglig i Lolly, där människor skapar nya filer enligt organisationens regler. Källbegränsningarna som DAM-systemet stöder och Lolly Works exponeringsregler styr åtkomsten. Granskning av det slutliga resultatet är ett separat beslut.

[Använd Lolly med ditt befintliga DAM](/info/use-with-dam.html) förklarar ansvarsfördelningen och begränsningarna. [SUSE:s erfarenheter av Brandfolder](/info/suse-brandfolder.html) dokumenterar en lyckad integration som stödde administratörernas förändringshantering inför en planerad migrering.

Lollys syfte är [innehållssuveränitet](/info/content-sovereignty.html), inklusive kontroll över produktionen och friheten att välja system. Dess eget bibliotek och godkännanden är till för organisationer som väljer att driva dessa funktioner själva. [Lolly för DAM-leverantörer och implementationspartner](/info/dam-partners.html) beskriver hur det anslutna arbetsflödet kan tillföra värde till ett befintligt huvudsystem.

<!--i:eti-award-->
## Vad en etablerad portal gör bättre

Etablerade portaler erbjuder hanterad hosting, support och omfattande arbetsflöden för tillgångshantering. [Frontifys DAM för företag](https://www.frontify.com/en/solution/enterprise-digital-asset-management) kombinerar tillgångssökning, åtkomstkontroller, godkännandeflöden och distribution. Lollys teknikstack är yngre. Dess godkännandekedjor är sekventiella och kan inte förgrenas fritt. [Lolly Work: status och färdplan](/info/work-status.html) beskriver dess driftsättningsbegränsningar.

<!--i:eti-blend-->
## Där de överlappar

Båda omfattar godkända tillgångar, låsta mallar, åtkomstkontroll, granskning och distribution. Lolly skapar filerna. Mallar, designtokens och tillåtna indata definierar vad någon får ändra, och renderingen kan stanna på den egna enheten. Lolly Work lägger till identitet, delad lagring, policy, godkännanden och rapportering på infrastruktur som organisationen kontrollerar.

![Det aktiva designsystemet i Settings, visat som ett omslag och sidor: färgerna, typsnitten och logotyperna som varje verktyg ritar med](/info/shots/dashboard-brand.svg)

<!--i:eti-lolly-->
## Vad Lolly och Lolly Work erbjuder

| Behov | Lolly + Lolly Work |
|---|---|
| Inloggning och provisionering | Enkel inloggning med OIDC, flera identitetsleverantörer, användarprovisionering och gruppmedlemskap med SCIM 2.0 samt inaktivering av konton som återkallar befintliga sessioner. En identitetsleverantör med enbart SAML kan ansluta via en OIDC-brygga som Keycloak. |
| Godkända mallar | Lolly definierar mallens redigerbara indata; Lolly Work tillämpar gruppsynlighet och indatapolicyer som låser värden, begränsar val eller döljer kontroller. |
| Delat tillgångsbibliotek | Uppladdningar som ägs av instansen, samlingar, anpassade metadata och åtkomststyrda kataloger, plus anslutningar som läser befintliga DAM- och lagringsbibliotek. |
| Granskning | Ordnade godkännandesteg, grupper med behöriga godkännare, kvorumregler och åtskillnad av uppgifter; granskning kan styra kataloginlämningar och leverans till organisationens destinationer. |
| Tillgångshistorik och tillgänglighet | Versioner och återställning för tillgångar som ägs av instansen, bevarande och bevarandespärrar, schemalagd tillgänglighet, förfall och återkallande. Anslutna leverantörer behåller sin egen källhistorik. |
| Licenser och källangivelser | Lolly registrerar licensen för varje källa en fil använder och förbereder de källangivelser som krävs; [Kreativa rättigheter och källangivelser](/info/creative-rights.html) förklarar vad som registreras och var källangivelser skrivs. Det klarerar inte rättigheter. |
| Rapportering | Antal tillgångsanvändningar och nedladdningar, verktygs- och exportaktivitet, instrumentpaneler och en granskningslogg. Kopplingen av användning till personer följer installationens telemetripolicy; standardinställningen för denna koppling kräver samtycke. |
| Distribution | Länkar som förfaller och kan återkallas, delade samlingar, gäståtkomst och leverans till konfigurerade organisationsdestinationer. |
| En offentlig varumärkessida | Lolly skriver en statisk [varumärkessida](/info/brand-page.html), från Lolly Design System Setup eller kommandoraden: logotyper, färger, typsnitt, regler och exempel för människor, med tokens, `DESIGN.md` och skills för agenter. Du hostar mappen, eller så aktiverar en administratör [hosting av varumärkessidor](/info/work-design-system-administration.html#host-a-brand-page) i Lolly Work, vilket är avstängt som standard. |

[Katalog och innehåll](/info/work-catalog.html), [Godkännanden](/info/work-approvals.html) och [Policy och styrning](/info/work-governance.html) beskriver dessa funktioner och deras konfiguration.

<!--i:eti-checklist-->
## Utvärdera det kombinerade arbetsflödet

Använd [produktionssekvensen för evenemangskort](/info/dam-production.html) för att testa källåtkomst, tillåtna ändringar, granskning av utdata och leverans med ditt eget bibliotek. [Vad som körs var](/info/compare.html#what-runs-where) listar begränsningarna som alla jämförelser delar. En källanslutning i sig innebär varken ett leverantörspartnerskap eller kvalificering för varje klientorganisation.

[Så står sig Lolly](/info/positioning.html) innehåller funktionsjämförelsen. Leverantörsnamnen identifierar de produkter som jämförs. Lolly har ingen koppling till dem.
