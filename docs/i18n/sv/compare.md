# Lolly jämfört, verktyg för verktyg

Om du redan använder en annan produkt säger de här sidorna om Lolly ersätter den produkten, fungerar vid sidan av den eller inte passar ditt arbete. Var och en börjar med vad den andra produkten gör bättre.

_Senast kontrollerad: 28 september 2026._

## Jämför per produkt

- [Lolly och Canva](/info/compare-canva.html) - mallar, vardagsdesign och delad varumärkesproduktion.
- [Lolly och Adobe](/info/compare-adobe.html) - redigering, konvertering, professionell utdata och Content Credentials.
- [Lolly och Figma](/info/compare-figma.html) - design, samarbete i realtid och återanvändbar tillgångsproduktion.
- [Lolly och Penpot](/info/compare-penpot.html) - design med öppen källkod, delade tokens och organisationsarbete.
- [Lolly och varumärkesportaler](/info/compare-brand-portals.html) - godkända bibliotek, låsta mallar, identitet, granskning och rapportering.
- [Lolly och renderings-API:er](/info/compare-render-apis.html) - automatiserad generering på din enhet, i CI eller på en Lolly Work-server.
- [Lolly och filomvandlare online](/info/compare-converters.html) - formatkonvertering på din egen enhet.

En jämförelse funktion för funktion finns i [Så jämför sig Lolly](/info/positioning.html). Varje jämförelse är daterad; ett påstående som inte längre stämmer för någon av produkterna behöver rättas.

## Vad som körs var

Varje jämförelse täcker två delar av ett projekt med öppen källkod. **Lolly** är motorn, apparna och verktygen. **Lolly Work** är organisationsservern, som underhålls i [arkivet lolly-work](https://github.com/lolly-tools/lolly-work). Båda är MPL-2.0, och en organisation avgör vilka Lolly Work-tjänster som slås på.

::: cols
## På din enhet: Lolly

- Inget konto för fristående användning
- Att skapa, redigera, konvertera och exportera
- Fungerar offline när verktygen och tillgångarna det behöver är sparade
- Content Credentials signerade på enheten
- Privata collabs mellan två enheter, utan server

## På din organisations server: Lolly Work

- Enkel inloggning, SCIM-provisionering, roller och policyer
- Delade kataloger, teamprojekt och arbetscollabs
- Godkännanden, användningsrapportering och granskningsposter
- Serverrendering, återställningsbara jobb och godkänd leverans
- Serversignering med organisationens identitet
:::

Fristående användning håller filerna på enheten. Att välja delade projekt, en arbetscollab, en serverrendering eller leverans skickar de data den funktionen behöver till din organisations server.

## Vad varje jämförelse förutsätter

De här gränserna gäller varje sida i den här uppsättningen, så de anges en gång här:

- **Arbetscollabs körs i dag på en enda servernod.** Deras skala och driftshistorik skiljer sig från de sedan länge etablerade värdbaserade produkterna. [Work status and roadmap](/info/work-status.html) registrerar de aktuella gränserna.
- **Webbplatsen på [lolly.work](https://lolly.work) är en demo-sandlåda.** En varaktig organisationsinstallation behöver beständig lagring och en operatör; [Install Lolly Work](/info/work-install.html) beskriver båda.
- **Det finns ingen programlicensavgift per plats** för Lolly eller en egen driftad Lolly Work. Hosting, lagring och drift kostar fortfarande pengar.
- **En signatur är inte en betrodd signerare.** En verifierare måste lita på certifikatet som signerade en fil innan den visar signeraren som betrodd; [Content Credentials Identity](/info/content-credentials-identity.html) förklarar hur.
