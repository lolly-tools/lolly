# Lolly og merkevareportaler

_Posisjonering oppdatert: 31. oktober 2026. Eksempel på leverandørfunksjoner sjekket: 28. september 2026._

Hvis organisasjonen din har de godkjente ressursene sine i Bynder, Frontify, Marq eller Brandfolder, sammenligner denne siden den portalen med Lolly pluss Lolly Work. Den dekker hvordan folk finner merkevareressurser og hvordan de lager nye filer av dem.

<!--i:eti-folder-shared-->
## Behold den eksisterende portalen

Et eksisterende DAM-system kan fortsatt være den autoritative kilden. Katalogkoblingene i Lolly Work gjør en valgt del av biblioteket tilgjengelig i Lolly, der folk lager nye filer etter organisasjonens regler. DAM-systemets støttede kildebegrensninger og eksponeringsreglene i Lolly Work styrer tilgangen. Gjennomgang av det ferdige resultatet er en separat avgjørelse.

[Bruk Lolly med ditt eksisterende DAM-system](/info/use-with-dam.html) forklarer ansvaret og begrensningene. [SUSEs erfaring med Brandfolder](/info/suse-brandfolder.html) dokumenterer en vellykket integrasjon som støttet administratorenes endringsstyring før en planlagt migrering.

Formålet med Lolly er [innholdssuverenitet](/info/content-sovereignty.html), inkludert kontroll over produksjonen og friheten til å velge systemer. Appens eget bibliotek og egne godkjenninger betjener organisasjoner som velger å drifte disse funksjonene selv. [Lolly for DAM-leverandører og implementeringspartnere](/info/dam-partners.html) beskriver hvordan den tilkoblede arbeidsflyten kan tilføre verdi til et eksisterende autoritativt system.

<!--i:eti-award-->
## Hva en etablert portal gjør bedre

Etablerte portaler tilbyr administrert hosting, støtte og omfattende arbeidsflyter for ressursforvaltning. [Frontifys DAM for virksomheter](https://www.frontify.com/en/solution/enterprise-digital-asset-management) kombinerer ressurssøk, tilgangskontroller, godkjenningsflyter og distribusjon. Lolly-stakken er yngre. Godkjenningskjedene er sekvensielle og kan ikke forgrenes vilkårlig. [Lolly Work-status og veikart](/info/work-status.html) dokumenterer begrensningene ved utrulling.

<!--i:eti-blend-->
## Hvor de overlapper

Begge dekker godkjente ressurser, låste maler, tilgangskontroll, gjennomgang og distribusjon. Lolly lager filene. Maler, designtokener og tillatte inndata definerer hva noen kan endre, og gjengivelsen kan forbli på enheten deres. Lolly Work legger til identitet, delt lagring, policy, godkjenninger og rapportering på infrastruktur organisasjonen kontrollerer.

![Det aktive designsystemet i Settings, vist som et omslag og sider: fargene, skriften og logoene hvert verktøy tegner med](/info/shots/dashboard-brand.svg)

<!--i:eti-lolly-->
## Hva Lolly og Lolly Work tilbyr

| Behov | Lolly + Lolly Work |
|---|---|
| Pålogging og provisjonering | OIDC-engangspålogging, flere identitetsleverandører, SCIM 2.0-brukerprovisjonering og gruppemedlemskap og deaktivering av kontoer som tilbakekaller eksisterende økter. En identitetsleverandør med bare SAML kan kobles til via en OIDC-bro som Keycloak. |
| Godkjente maler | Lolly definerer malens redigerbare inndata; Lolly Work håndhever synlighet for grupper og inndatapolicyer som låser verdier, begrenser valg eller skjuler kontroller. |
| Delt ressursbibliotek | Instanseide opplastinger, samlinger, egendefinerte metadata og tilgangsstyrte kataloger, pluss koblinger som leser eksisterende DAM- og lagringsbiblioteker. |
| Gjennomgang | Ordnede godkjenningstrinn, kvalifiserte godkjennergrupper, regler for minste antall godkjennere og ansvarsdeling; gjennomgang kan styre kataloginnsendinger og levering til organisasjonens mål. |
| Ressurshistorikk og tilgjengelighet | Versjoner og tilbakeføring for instanseide ressurser, oppbevaring og bevaringspålegg, planlagt tilgjengelighet, utløp og tilbakekalling. Tilkoblede leverandører beholder sin egen kildehistorikk. |
| Lisenser og kreditering | Lolly registrerer lisensen til hver kilde en fil bruker og klargjør krediteringen den krever; [Rettigheter og kreditering for kreativt arbeid](/info/creative-rights.html) forklarer hva som registreres og hvor krediteringen skrives. Appen klarerer ikke rettigheter. |
| Rapportering | Antall ressursbruk og nedlastinger, verktøy- og eksportaktivitet, dashbord og et revisjonsspor. Tilordning av bruk følger installasjonens telemetripolicy; standardinnstillingen for tilordning krever samtykke. |
| Distribusjon | Lenker med utløp som kan tilbakekalles, delte samlinger, gjestetilgang og levering til konfigurerte organisasjonsdestinasjoner. |
| En offentlig merkevareside | Lolly skriver en statisk [merkevareside](/info/brand-page.html) fra Lolly Design System Setup eller kommandolinjen: logoer, farger, skrift, regler og eksempler for mennesker, med tokener, `DESIGN.md` og ferdigheter for agenter. Du hoster mappen, eller en administrator slår på [hosting av merkevaresider](/info/work-design-system-administration.html#host-a-brand-page) i Lolly Work, som er av som standard. |

[Katalog og innhold](/info/work-catalog.html), [Godkjenninger](/info/work-approvals.html) og [Policy og styring](/info/work-governance.html) beskriver disse funksjonene og hvordan de konfigureres.

<!--i:eti-checklist-->
## Vurder den kombinerte arbeidsflyten

Bruk [produksjonssekvensen for arrangementskort](/info/dam-production.html) til å teste kildetilgang, tillatte redigeringer, gjennomgang av resultater og levering med ditt eget bibliotek. [Hva kjører hvor](/info/compare.html#what-runs-where) lister begrensningene alle sammenligningene deler. En kildekobling alene etablerer ikke et leverandørpartnerskap eller kvalifisering for hver leietaker.

[Slik sammenlignes Lolly](/info/positioning.html) har funksjonssammenligningen. Leverandørnavnene identifiserer produktene som sammenlignes. Lolly er ikke tilknyttet dem.
