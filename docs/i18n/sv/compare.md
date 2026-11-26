# Lolly jämfört, verktyg för verktyg

De här sidorna säger om Lolly ersätter en annan produkt, fungerar tillsammans med den eller inte passar ditt arbete. Varje sida börjar med vad den andra produkten gör bättre.

_Senast kontrollerat: 28 september 2026._

<!--i:eti-grid-->
## Jämför efter produkt

- [Lolly och Canva](/info/compare-canva.html) - mallar, vardaglig design och gemensam varumärkesproduktion.
- [Lolly och Adobe](/info/compare-adobe.html) - redigering, konvertering, professionella utdata och Content Credentials.
- [Lolly och Figma](/info/compare-figma.html) - design, samarbete i realtid och återanvändbar tillgångsproduktion.
- [Lolly och Penpot](/info/compare-penpot.html) - design med öppen källkod, gemensamma tokens och arbete i organisationer.
- [Lolly och varumärkesportaler](/info/compare-brand-portals.html) - godkända bibliotek, låsta mallar, identitet, granskning och rapportering.
- [Lolly och renderings-API:er](/info/compare-render-apis.html) - automatiserad generering på din enhet, i CI eller på din egen server samt [hur du flyttar](/info/work-move-from-render-api.html) från Bannerbear eller Placid.
- [Lolly och filkonverterare på nätet](/info/compare-converters.html) - formatkonvertering på din egen enhet.

[Så står sig Lolly](/info/positioning.html) ger en jämförelse funktion för funktion. Varje jämförelse är daterad. Ett påstående som inte längre stämmer med någon av produkterna behöver rättas.

<!--i:eti-map-pin-->
## Vad som körs var

Varje jämförelse omfattar två delar av ett projekt med öppen källkod. **Lolly** är motorn, apparna och verktygen. **Lolly Work** är organisationsservern, som underhålls i [kodförrådet lolly-work](https://github.com/lolly-tools/lolly-work). Båda är MPL-2.0, och en organisation bestämmer vilka Lolly Work-tjänster som ska aktiveras.

::: cols
## På din enhet: Lolly

- Inget konto för fristående användning
- Skapa, redigera, konvertera och exportera
- Fungerar offline när verktygen och tillgångarna som behövs är sparade
- Content Credentials signerade på enheten
- Privata collabs mellan två enheter, utan server

## På din organisations server: Lolly Work

- Enkel inloggning, SCIM-provisionering, roller och policyer
- Delade kataloger, teamprojekt och work collabs
- Godkännanden, användningsrapportering och granskningsposter
- Serverrendering, återställningsbara jobb och godkänd leverans
- Serversignering med organisationens identitet
:::

Fristående användning behåller filer på enheten. Om du väljer delade projekt, en work collab, en serverrendering eller leverans skickas de data som funktionen behöver till din organisations server.

<!--i:eti-info-->
## Vad varje jämförelse utgår från

De här begränsningarna gäller varje sida i den här samlingen:

- **Lolly Work-collabs körs på en enda servernod i dag.** Deras skala och drifthistorik skiljer sig från de sedan länge etablerade hostade produkternas. [Lolly Work: status och färdplan](/info/work-status.html) beskriver de aktuella begränsningarna.
- **Webbplatsen på [lolly.work](https://lolly.work) är en demosandlåda.** En varaktig organisationsinstallation behöver beständig lagring och en driftansvarig. [Installera Lolly Work](/info/work-install.html) tar upp båda.
- **Det finns ingen programlicensavgift per användare** för Lolly eller Lolly Work på egen server. Hosting, lagring och drift kostar fortfarande pengar.
- **En signatur innebär inte att signeraren är betrodd.** En verifierare visar signeraren som betrodd bara när verifieraren litar på certifikatet som signerade filen. [Identitet för Content Credentials](/info/content-credentials-identity.html) förklarar hur.
