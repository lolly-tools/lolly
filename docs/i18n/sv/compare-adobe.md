# Lolly och Adobe

_Senast kontrollerad: 28 september 2026._

Lolly hanterar bildredigering och konvertering, layout, repeterbar varumärkesproduktion, tryckutdata och Content Credentials. [lolly.work](https://lolly.work) lägger till organisationsidentitet, delade resurser, godkännanden och automatiserad serverproduktion i det kreativa arbetsflödet.

## Där de överlappar

Båda stöder arbete som att ändra storlek på bilder, komponera layouter och exportera professionella format. Lolly stöder PDF/X, CMYK och rasterutdata med högt bitdjup, med [formatspecifika funktioner](/info/formats.html). Verktygen på enheten konverterar och rensar filer utan att ladda upp dem.

Adobes specialiserade program täcker omfattande kreativa arbetsflöden. [Photoshop](https://www.adobe.com/products/photoshop.html) erbjuder till exempel detaljerade verktyg för fotoredigering, markering, maskning och sammansättning. Jämför de redigeringsoperationer ditt arbete kräver med Lollys verktyg; en återkommande varumärkesresurs och en komplex retuschering kan ha olika krav.

## Skapande- och organisationstjänster

Fristående Lolly körs utan Adobe-konto och utan Lolly-konto, med samma motor i webbläsaren, skrivbordsappen och CLI. Mallar och designtokens gör utdata repeterbar, och [Dela med regler](/info/create-a-tool.html) förvandlar en design till ett verktyg som andra kan fylla i.

lolly.work är en separat tjänst inom Lolly-projektet och är öppen källkod under MPL-2.0, precis som de kreativa apparna. Den tillhandahåller SSO, SCIM, delade kataloger och projekt, godkännanden, åtkomstpolicyer, granskningsloggar och serverrendering. En organisation kan driva båda delarna själv och ansluta befintliga resursbibliotek. Lokalt skapande stannar på enheten; delat arbete och serverjobb använder de konfigurerade tjänsterna.

## Content Credentials och identitet

Lolly kan signera exporter som stöds på enheten, med Content Credentials aktiverade av användaren. En nyckel som genereras på enheten bevisar filsignaturens integritet; en verifierare måste ändå lita på undertecknaren innan en verifierad identitet visas. En organisation kan använda sin egen certifikatutfärdare och distribuera dess rotcertifikat till sina verifierare. lolly.work stöder även serversignering med ett konfigurerat organisationscertifikat och en konfigurerad nyckel.

Det gör att både personlig signering och organisationssignering finns tillgängliga inom Lolly-lösningen. Se [Content Credentials Identity](/info/content-credentials-identity.html), [lolly.work-guiden för signering](https://github.com/lolly-tools/lolly-work/blob/main/docs/c2pa.md) och [översikten över den kombinerade lösningen](/info/compare.html). Transformeringsverktygen på enheten lägger inte till Lolly-vattenmärken eller proveniensmetadata.

Adobe, Photoshop och Creative Cloud är varumärken som tillhör Adobe. Den här sidan beskriver var lösningarna överlappar och är inte knuten till Adobe.
