# Lolly og Adobe

_Sist kontrollert: 28. september 2026._

Lolly håndterer bilderedigering og -konvertering, layout, repeterbar merkevareproduksjon, trykkutdata og Content Credentials. [lolly.work](https://lolly.work) legger organisasjonsidentitet, delte ressurser, godkjenninger og automatisert serverproduksjon til denne kreative arbeidsflyten.

## Hvor de overlapper

Begge støtter arbeid som å endre størrelse på bilder, sette sammen layouter og eksportere profesjonelle formater. Lolly støtter PDF/X, CMYK og rasterutdata med høy bitdybde, med [formatspesifikke funksjoner](/info/formats.html). Verktøyene på enheten konverterer og renser filer uten å laste dem opp.

Adobes spesialiserte programmer dekker omfattende kreative arbeidsflyter. [Photoshop](https://www.adobe.com/products/photoshop.html) har for eksempel detaljerte verktøy for bilderedigering, utvalg, maskering og komposisjon. Sammenlign redigeringsoperasjonene arbeidet ditt krever, med Lollys verktøy; en gjentakende merkevareressurs og en kompleks retusjering kan ha ulike krav.

## Opprettelse og organisasjonstjenester

Frittstående Lolly kjører uten Adobe-konto eller Lolly-konto, med samme motor i nettleseren, skrivebordsappen og CLI. Maler og designtokens gjør utdata repeterbare, og [Del med regler](/info/create-a-tool.html) gjør et design om til et verktøy andre kan fylle ut.

lolly.work er en separat tjeneste i Lolly-prosjektet, åpen kildekode under MPL-2.0 som de kreative appene. Den tilbyr SSO, SCIM, delte kataloger og prosjekter, godkjenninger, tilgangspolicyer, revisjonslogger og servergjengivelse. En organisasjon kan drifte begge delene selv og koble til eksisterende ressursbiblioteker. Lokal opprettelse blir på enheten; delt arbeid og serverjobber bruker de konfigurerte tjenestene.

## Content Credentials og identitet

Lolly kan signere støttede eksporter på enheten, med Content Credentials aktivert av brukeren. En nøkkel generert på enheten beviser integriteten til filens signatur; en verifikator må likevel stole på signereren før en verifisert identitet vises. En organisasjon kan bruke sin egen sertifiseringsinstans og distribuere rotsertifikatet sitt til verifikatorene. lolly.work støtter også serversignering med et konfigurert organisasjonssertifikat og en konfigurert nøkkel.

Det gjør både personlig signering og organisasjonssignering tilgjengelig i Lolly-løsningen. Se [Content Credentials Identity](/info/content-credentials-identity.html), [signeringsveiledningen for lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/c2pa.md) og [oversikten over den samlede løsningen](/info/compare.html). Transformasjonsverktøyene på enheten legger ikke til Lolly-vannmerker eller proveniensmetadata.

Adobe, Photoshop og Creative Cloud er varemerker tilhørende Adobe. Denne siden beskriver hvor løsningene overlapper, og er ikke tilknyttet Adobe.
