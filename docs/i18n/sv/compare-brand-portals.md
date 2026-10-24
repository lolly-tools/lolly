# Lolly och varumärkesportaler

_Senast kontrollerad: 28 september 2026._

Om din organisation förvarar sina godkända tillgångar i Bynder, Frontify, Marq eller Brandfolder jämför den här sidan det med Lolly plus Lolly Work: hur folk hittar varumärkestillgångar, och hur de gör nya filer av dem.

## Vad en etablerad portal gör bättre

Etablerade portaler erbjuder hanterad hosting, support och omfattande arbetsflöden för tillgångshantering. [Frontifys enterprise DAM](https://www.frontify.com/en/solution/enterprise-digital-asset-management) kombinerar till exempel tillgångsupptäckt, åtkomstkontroller, godkännandearbetsflöden och distribution. Lolly-stacken är yngre och dess godkännandekedjor är sekventiella snarare än godtyckligt förgrenade arbetsflöden. [Work status and roadmap](/info/work-status.html) registrerar dess driftgränser.

## Där de överlappar

Båda täcker godkända tillgångar, låsta mallar, åtkomstkontroll, granskning och distribution. Lolly gör filerna: mallar, designtokens och tillåtna indata definierar vad någon kan ändra, och renderingen kan stanna på deras enhet. Lolly Work lägger till identitet, delad lagring, policy, godkännanden och rapportering på infrastruktur som organisationen kontrollerar.

![Det aktiva designsystemet i Settings, visat som ett omslag och sidor: färgerna, typografin och logotyperna som varje verktyg ritar med](/info/shots/dashboard-brand.svg)

## Vad Lolly och Lolly Work tillhandahåller

| Behov | Lolly + Lolly Work |
|---|---|
| Inloggning och provisionering | OIDC-enkel inloggning, flera identitetsleverantörer, SCIM 2.0-användarprovisionering och gruppmedlemskap, och kontoavaktivering som återkallar befintliga sessioner. En identitetsleverantör med bara SAML kan ansluta genom en OIDC-brygga som Keycloak. |
| Godkända mallar | Lolly definierar mallens redigerbara indata; Lolly Work tillämpar gruppsynlighet och indatapolicyer som låser värden, begränsar val eller döljer kontroller. |
| Delat tillgångsbibliotek | Uppladdningar ägda av instansen, samlingar, anpassade metadata och åtkomststyrda kataloger, plus kopplingar som läser befintliga DAM- och lagringsbibliotek. |
| Granskning | Ordnade godkännandesteg, behöriga godkännargrupper, kvorumregler och uppdelning av ansvar; granskning kan styra katalogbidrag och leverans till organisationsmål. |
| Tillgångshistorik och tillgänglighet | Versioner och återställning för tillgångar ägda av instansen, lagring och spärrar, schemalagd tillgänglighet, utgång och återkallelse. Anslutna leverantörer behåller sin egen källhistorik. |
| Licenser och krediter | Lolly registrerar licensen för varje källa en fil använder och förbereder krediterna den är skyldig; [Kreativa rättigheter och krediter](/info/creative-rights.html) förklarar vad den registrerar och var krediter skrivs. Den klarerar inte rättigheter. |
| Rapportering | Antal för tillgångsanvändning och nedladdning, verktygs- och exportaktivitet, instrumentpaneler och ett granskningsspår. Användningstillskrivning följer installationens telemetripolicy; standardinställningen för tillskrivning kräver samtycke. |
| Distribution | Utgående, återkallelsebara länkar, delade samlingar, gäståtkomst och leverans till konfigurerade organisationsdestinationer. |

[Catalog and content](/info/work-catalog.html), [Approvals](/info/work-approvals.html) och [Policy and governance](/info/work-governance.html) beskriver de här funktionerna och deras konfiguration.

## Behåll din befintliga portal

En befintlig DAM kan förbli källan till sanning. Lolly Works katalogkopplingar gör dess godkända tillgångar tillgängliga i Lolly, där folk gör nya filer under organisationens regler. Det är ett integrationsval; Lollys eget bibliotek och egna godkännanden finns där när organisationen vill köra dem själv. [Vad som körs var](/info/compare.html#what-runs-where) listar gränserna som varje jämförelse delar.

Se [Hur Lolly står sig](/info/positioning.html) för förmågejämförelsen. Leverantörsnamn identifierar produkterna som jämförs; Lolly är inte knutet till dem.
