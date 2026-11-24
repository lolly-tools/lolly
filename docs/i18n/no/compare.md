# Lolly sammenlignet, verktøy for verktøy

Disse sidene sier om Lolly erstatter et annet produkt, fungerer sammen med det produktet eller ikke passer til arbeidet ditt. Hver side begynner med det det andre produktet gjør bedre.

_Sist sjekket: 28. september 2026._

<!--i:eti-grid-->
## Sammenlign etter produkt

- [Lolly og Canva](/info/compare-canva.html) - maler, hverdagsdesign og felles merkevareproduksjon.
- [Lolly og Adobe](/info/compare-adobe.html) - redigering, konvertering, profesjonelle resultater og Content Credentials.
- [Lolly og Figma](/info/compare-figma.html) - design, levende samarbeid og gjenbrukbar ressursproduksjon.
- [Lolly og Penpot](/info/compare-penpot.html) - design med åpen kildekode, delte tokener og organisasjonsarbeid.
- [Lolly og merkevareportaler](/info/compare-brand-portals.html) - godkjente biblioteker, låste maler, identitet, gjennomgang og rapportering.
- [Lolly og API-er for gjengivelse](/info/compare-render-apis.html) - automatisert generering på enheten din, i CI eller på din egen server, og [slik flytter du](/info/work-move-from-render-api.html) fra Bannerbear eller Placid.
- [Lolly og nettbaserte filkonverterere](/info/compare-converters.html) - formatkonvertering på din egen enhet.

[Slik sammenlignes Lolly](/info/positioning.html) viser funksjonene side om side. Hver sammenligning er datert. En påstand som ikke lenger stemmer for et av produktene, må rettes.

<!--i:eti-map-pin-->
## Hva kjører hvor

Hver sammenligning dekker to deler av ett prosjekt med åpen kildekode. **Lolly** er motoren, appene og verktøyene. **Lolly Work** er organisasjonsserveren, som vedlikeholdes i [lolly-work-kodelageret](https://github.com/lolly-tools/lolly-work). Begge er MPL-2.0, og en organisasjon bestemmer hvilke Lolly Work-tjenester som skal slås på.

::: cols
## På enheten din: Lolly

- Ingen konto for frittstående bruk
- Oppretting, redigering, konvertering og eksport
- Fungerer uten nett når verktøyene og ressursene som trengs, er lagret
- Content Credentials signert på enheten
- Private samarbeid mellom to enheter, uten server

## På organisasjonens server: Lolly Work

- Engangspålogging, SCIM-provisjonering, roller og policyer
- Delte kataloger, teamprosjekter og arbeidssamarbeid
- Godkjenninger, bruksrapportering og revisjonsposter
- Gjengivelse på server, gjenopprettbare jobber og godkjent levering
- Serversignering med organisasjonens identitet
:::

Frittstående bruk holder filene på enheten. Hvis du velger delte prosjekter, et arbeidssamarbeid, en gjengivelse på server eller levering, sendes dataene funksjonen trenger til organisasjonens server.

<!--i:eti-info-->
## Hva alle sammenligninger forutsetter

Disse begrensningene gjelder alle sidene i denne samlingen:

- **Lolly Work-samarbeid kjører på én servernode i dag.** Skalaen og driftshistorikken deres skiller seg fra de veletablerte vertsbaserte produktene. [Lolly Work-status og veikart](/info/work-status.html) dokumenterer de gjeldende begrensningene.
- **Nettstedet på [lolly.work](https://lolly.work) er en demosandkasse.** En varig organisasjonsinstallasjon trenger vedvarende lagring og en driftsansvarlig. [Installer Lolly Work](/info/work-install.html) dekker begge deler.
- **Det er ingen programvarelisensavgift per bruker** for Lolly eller en Lolly Work-instans du drifter selv. Hosting, lagring og drift koster fortsatt penger.
- **En signatur er ikke en betrodd signatar.** Et verifiseringsverktøy viser signataren som betrodd bare når verktøyet stoler på sertifikatet som signerte filen. [Identitet i Content Credentials](/info/content-credentials-identity.html) forklarer hvordan.
