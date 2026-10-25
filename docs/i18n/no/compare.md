# Lolly sammenlignet, verktøy for verktøy

Hvis du allerede bruker et annet produkt, sier disse sidene om Lolly erstatter det produktet, virker ved siden av det eller ikke passer arbeidet ditt. Hver begynner med det det andre produktet gjør bedre.

_Sist kontrollert: 28. september 2026._

## Sammenlign etter produkt

- [Lolly and Canva](/info/compare-canva.html) - maler, hverdagsdesign og delt merkevareproduksjon.
- [Lolly and Adobe](/info/compare-adobe.html) - redigering, konvertering, profesjonelt resultat og Content Credentials.
- [Lolly and Figma](/info/compare-figma.html) - design, samarbeid i sanntid og gjenbrukbar ressursproduksjon.
- [Lolly and Penpot](/info/compare-penpot.html) - åpen kildekode-design, delte tokener og organisasjonsarbeid.
- [Lolly and brand portals](/info/compare-brand-portals.html) - godkjente biblioteker, låste maler, identitet, gjennomgang og rapportering.
- [Lolly and rendering APIs](/info/compare-render-apis.html) - automatisert generering på enheten din, i CI eller på en Lolly Work-server.
- [Lolly and online file converters](/info/compare-converters.html) - formatkonvertering på din egen enhet.

For en oversikt over funksjon for funksjon, se [Hvordan Lolly sammenlignes](/info/positioning.html). Hver sammenligning er datert; en påstand som ikke lenger stemmer for et av produktene, må rettes.

## Hva som kjører hvor

Hver sammenligning dekker to deler av ett åpen kildekode-prosjekt. **Lolly** er motoren, appene og verktøyene. **Lolly Work** er organisasjonsserveren, vedlikeholdt i [lolly-work-repositoriet](https://github.com/lolly-tools/lolly-work). Begge er MPL-2.0, og en organisasjon avgjør hvilke Lolly Work-tjenester som slås på.

::: cols
## På enheten din: Lolly

- Ingen konto for frittstående bruk
- Å lage, redigere, konvertere og eksportere
- Fungerer uten nett når verktøyene og ressursene det trenger, er lagret
- Content Credentials signert på enheten
- Private collabs mellom to enheter, uten server

## På organisasjonens server: Lolly Work

- Enkel pålogging, SCIM-klargjøring, roller og policyer
- Delte kataloger, teamprosjekter og work collabs
- Godkjenninger, bruksrapportering og revisjonsposter
- Servergjengivelse, gjenopprettbare jobber og godkjent levering
- Serversignering med organisasjonens identitet
:::

Frittstående bruk holder filene på enheten. Å velge delte prosjekter, en work collab, en servergjengivelse eller levering sender dataene den funksjonen trenger til organisasjonens server.

## Hva hver sammenligning forutsetter

Disse grensene gjelder for hver side i dette settet, så de oppgis én gang her:

- **Work collabs kjører på én enkelt servernode i dag.** Skalaen og driftshistorikken deres er annerledes enn de veletablerte vertsbaserte produktene. [Work status and roadmap](/info/work-status.html) registrerer de gjeldende grensene.
- **Nettstedet på [lolly.work](https://lolly.work) er en demosandkasse.** En varig organisasjonsinstallasjon trenger vedvarende lagring og en driftsansvarlig; [Install Lolly Work](/info/work-install.html) dekker begge.
- **Det er ingen programvarelisens per bruker** for Lolly eller en selvhostet Lolly Work. Hosting, lagring og drift koster fortsatt penger.
- **En signatur er ikke en klarert signerer.** En verifiserer må stole på sertifikatet som signerte en fil før den viser signereren som klarert; [Content Credentials Identity](/info/content-credentials-identity.html) forklarer hvordan.
