# Lolly og merkevareportaler

_Posisjonering oppdatert: 31. oktober 2026. Eksempel på leverandørfunksjon kontrollert: 28. september 2026._

Hvis organisasjonen din har sine godkjente ressurser i Bynder, Frontify, Marq eller Brandfolder, sammenligner denne siden det med Lolly pluss Lolly Work: hvordan folk finner merkevareressurser, og hvordan de lager nye filer av dem.

## Å beholde den eksisterende portalen

En eksisterende DAM kan forbli kilden som gjelder. Lolly Works katalogkoblinger gjør en valgt del av biblioteket tilgjengelig i Lolly, der folk lager nye filer under organisasjonens regler. DAM-ens støttede kildebegrensninger og Lolly Works eksponeringsregler styrer tilgangen; gjennomgang av sluttresultatet er en egen beslutning.

[Use Lolly with your existing DAM](/info/use-with-dam.html) forklarer ansvar og grenser. [SUSE's Brandfolder experience](/info/suse-brandfolder.html) registrerer en vellykket integrasjon som støttet administratorenes endringsledelse før en planlagt migrering. Å holde kilden tilkoblet er fortsatt et støttet valg.

Lollys formål er [innholdssuverenitet](/info/content-sovereignty.html), blant annet kontroll over produksjonen og frihet til å velge systemer. Lollys eget bibliotek og egne godkjenninger støtter organisasjoner som velger å drive disse funksjonene selv. [Lolly for DAM vendors and implementation partners](/info/dam-partners.html) beskriver hvordan den tilkoblede arbeidsflyten kan tilføre verdi til et eksisterende system som gjelder som kilde.

## Hva en etablert portal gjør bedre

Etablerte portaler tilbyr administrert hosting, støtte og omfattende arbeidsflyter for ressursforvaltning. [Frontifys enterprise DAM](https://www.frontify.com/en/solution/enterprise-digital-asset-management) kombinerer for eksempel ressursoppdagelse, tilgangskontroller, godkjenningsarbeidsflyter og distribusjon. Lolly-stakken er yngre, og godkjenningskjedene er sekvensielle i stedet for vilkårlige forgrenende arbeidsflyter. [Lolly Work status and roadmap](/info/work-status.html) registrerer driftsgrensene.

## Hvor de overlapper

Begge dekker godkjente ressurser, låste maler, tilgangskontroll, gjennomgang og distribusjon. Lolly lager filene: maler, designtokener og tillatte inndata definerer hva noen kan endre, og gjengivelse kan bli på deres enhet. Lolly Work legger til identitet, delt lagring, policy, godkjenninger og rapportering på infrastruktur organisasjonen kontrollerer.

![Det aktive designsystemet i Settings, vist som et omslag og sider: fargene, skriften og logoene hvert verktøy tegner med](/info/shots/dashboard-brand.svg)

## Hva Lolly og Lolly Work leverer

| Behov | Lolly + Lolly Work |
|---|---|
| Pålogging og klargjøring | OIDC-enkelpålogging, flere identitetsleverandører, SCIM 2.0-brukerklargjøring og gruppemedlemskap, og kontodeaktivering som tilbakekaller eksisterende økter. En identitetsleverandør som bare har SAML, kan kobles til gjennom en OIDC-bro som Keycloak. |
| Godkjente maler | Lolly definerer malens redigerbare inndata; Lolly Work bruker gruppesynlighet og inndatapolicyer som låser verdier, begrenser valg eller skjuler kontroller. |
| Delt ressursbibliotek | Opplastinger eid av instansen, samlinger, egendefinerte metadata og tilgangsstyrte kataloger, pluss koblinger som leser eksisterende DAM- og lagringsbiblioteker. |
| Gjennomgang | Ordnede godkjenningstrinn, kvalifiserte godkjennergrupper, kvorumregler og funksjonsdeling; gjennomgang kan styre katalogoppføringer og levering til organisasjonsmål. |
| Ressurshistorikk og tilgjengelighet | Versjoner og tilbakerulling for ressurser eid av instansen, oppbevaring og sperrer, planlagt tilgjengelighet, utløp og tilbakekalling. Tilkoblede leverandører beholder sin egen kildehistorikk. |
| Lisenser og kreditter | Lolly registrerer lisensen til hver kilde en fil bruker og forbereder kredittene den skylder; [Creative rights and credits](/info/creative-rights.html) forklarer hva den registrerer og hvor kreditter skrives. Den avklarer ikke rettigheter. |
| Rapportering | Antall ressursbruk og nedlastinger, verktøy- og eksportaktivitet, dashbord og et revisjonsspor. Bruksattribusjon følger installasjonens telemetripolicy; standard attribusjonsinnstilling krever samtykke. |
| Distribusjon | Utløpende, tilbakekallbare lenker, delte samlinger, gjestetilgang og levering til konfigurerte organisasjonsdestinasjoner. |
| En offentlig merkevareside | Lolly skriver en statisk [brand page](/info/brand-page.html), fra Lolly Design System Setup eller kommandolinjen: logoer, farger, skrift, regler og eksempler for mennesker, med tokener, `DESIGN.md` og skills for agenter. Du hoster mappen, eller en administrator slår på [brand page hosting](/info/work-design-system-administration.html#host-a-brand-page) i Lolly Work, som er av som standard. |

[Catalog and content](/info/work-catalog.html), [Approvals](/info/work-approvals.html) og [Policy and governance](/info/work-governance.html) beskriver disse funksjonene og konfigurasjonen deres.

## Evaluer den kombinerte arbeidsflyten

Bruk [the event-card production sequence](/info/dam-production.html) for å teste kildetilgang, tillatte redigeringer, gjennomgang av resultatet og levering med ditt eget bibliotek. [What runs where](/info/compare.html#what-runs-where) lister grensene hver sammenligning deler. En kildetilkobling etablerer ikke i seg selv et leverandørpartnerskap eller kvalifisering for hver tenant.

Se [How Lolly compares](/info/positioning.html) for kapabilitetssammenligningen. Leverandørnavn identifiserer produktene som sammenlignes; Lolly er ikke tilknyttet dem.
