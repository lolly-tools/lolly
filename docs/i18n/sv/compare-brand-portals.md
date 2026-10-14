# Lolly och varumärkesportaler

_Senast kontrollerad: 28 september 2026._

Lolly och [lolly.work](https://lolly.work) täcker tillsammans de skapande- och styrningsarbetsflöden som team använder varumärkesportaler för: godkända resurser, låsta mallar, åtkomstkontroll, granskning och distribution. Jämför den kombinerade lösningen med Bynder, Frontify, Marq eller Brandfolder när du väljer hur människor hittar varumärkesresurser och skapar nya.

## Skapande- och organisationstjänster

Lollys motor och appar skapar filerna. Mallar, designtokens och tillåtna indata avgör vad någon kan ändra, och renderingen kan stanna på deras enhet. Fristående Lolly kräver inget konto.

lolly.work är organisationstjänsten i samma projekt, underhålls i ett [separat repository](https://github.com/lolly-tools/lolly-work) och driftsätts tillsammans med Lolly. Den lägger till identitet, delad lagring, policyer, godkännanden och rapportering. Båda delarna är öppen källkod under MPL-2.0. Uppdelningen gör att en enskild person kan använda Lolly fristående och en organisation kan driva den kombinerade lösningen på infrastruktur som den själv kontrollerar.

## Vad den kombinerade lösningen erbjuder

| Behov | Lolly + lolly.work |
|---|---|
| Inloggning och provisionering | OIDC single sign-on, flera identitetsleverantörer, SCIM 2.0-provisionering av användare och gruppmedlemskap samt kontoinaktivering som återkallar befintliga sessioner. En identitetsleverantör som endast stöder SAML kan anslutas via en OIDC-brygga som Keycloak. |
| Godkända mallar | Lolly definierar mallens redigerbara indata; lolly.work tillämpar gruppsynlighet och indatapolicyer som låser värden, begränsar val eller döljer kontroller. |
| Delat resursbibliotek | Uppladdningar som ägs av instansen, samlingar, anpassade metadata och åtkomststyrda kataloger, plus kopplingar som läser befintliga DAM- och lagringsbibliotek. |
| Granskning | Ordnade godkännandesteg, behöriga godkännargrupper, kvorumregler och funktionsseparation; granskning kan styra katalogbidrag och leverans till organisationens mål. |
| Resurshistorik och tillgänglighet | Versioner och återställning för resurser som ägs av instansen, lagringstider och spärrar, schemalagd tillgänglighet, utgång och återkallelse. Anslutna leverantörer behåller sin egen källhistorik. |
| Rapportering | Antal användningar och nedladdningar av resurser, verktygs- och exportaktivitet, instrumentpaneler och ett granskningsspår. Tillskrivning av användning följer driftsättningens telemetripolicy; standardinställningen för tillskrivning kräver samtycke. |
| Distribution | Länkar som löper ut och kan återkallas, delade samlingar, gäståtkomst och leverans till konfigurerade mål i organisationen. |

[Driftguiderna för lolly.work](https://github.com/lolly-tools/lolly-work/tree/main/docs) beskriver de här funktionerna och hur de konfigureras. De är tillgängliga funktioner, inte funktioner som kräver att du bygger ett annat system runt Lolly.

## Att välja arbetsflöde i en portal

Etablerade portaler erbjuder hanterad drift, support och omfattande DAM-arbetsflöden. [Frontifys DAM för företag](https://www.frontify.com/en/solution/enterprise-digital-asset-management) kombinerar till exempel resursupptäckt, åtkomstkontroller, godkännandearbetsflöden och distribution. Jämför exakt vilket gransknings- och rättighetsarbetsflöde du behöver: Lolly tillhandahåller metadata samt kontroller för åtkomst och tillgänglighet, medan juridiskt godkännande och licensskyldigheter fortfarande kräver en organisations egen process. Dess godkännandekedjor är sekventiella; de modellerar inte godtyckligt förgrenade arbetsflöden.

Lolly-stacken är yngre, och [statussidan för lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) redovisar dess driftsättningsbegränsningar. Framför allt är den publika webbplatsen lolly.work en utvärderingssandlåda. En varaktig driftsättning i en organisation kräver beständig lagring och en driftansvarig. Det tillkommer ingen programvarulicensavgift per användare för egen drift; infrastruktur och administration kostar fortfarande pengar.

En befintlig DAM kan också förbli den auktoritativa källan. Katalogkopplingarna i lolly.work gör dess godkända resurser tillgängliga i Lolly, där människor skapar nya filer enligt organisationens regler. Det är ett integrationsval; Lollys eget bibliotek och egna godkännanden finns tillgängliga när organisationen vill hantera de arbetsflödena själv.

Se [Så jämför sig Lolly](/info/positioning.html) för funktionsjämförelsen och [Lolly jämfört, verktyg för verktyg](/info/compare.html) för resten av serien. Leverantörsnamn identifierar de produkter som jämförs; Lolly är inte knuten till dem.
