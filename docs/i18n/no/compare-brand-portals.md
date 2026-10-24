# Lolly og merkevareportaler

_Sist kontrollert: 28. september 2026._

Hvis organisasjonen din har sine godkjente ressurser i Bynder, Frontify, Marq eller Brandfolder, sammenligner denne siden det med Lolly pluss Lolly Work: hvordan folk finner merkevareressurser, og hvordan de lager nye filer av dem.

## Hva en etablert portal gjør bedre

Etablerte portaler tilbyr administrert hosting, støtte og omfattende arbeidsflyter for ressursforvaltning. [Frontifys enterprise DAM](https://www.frontify.com/en/solution/enterprise-digital-asset-management) kombinerer for eksempel ressursoppdagelse, tilgangskontroller, godkjenningsarbeidsflyter og distribusjon. Lolly-stakken er yngre, og godkjenningskjedene er sekvensielle i stedet for vilkårlige forgrenende arbeidsflyter. [Work status and roadmap](/info/work-status.html) registrerer driftsgrensene.

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

[Catalog and content](/info/work-catalog.html), [Approvals](/info/work-approvals.html) og [Policy and governance](/info/work-governance.html) beskriver disse funksjonene og konfigurasjonen deres.

## Å beholde den eksisterende portalen

En eksisterende DAM kan forbli sannhetskilden. Lolly Works katalogkoblinger gjør de godkjente ressursene tilgjengelige i Lolly, der folk lager nye filer under organisasjonens regler. Det er et integrasjonsvalg; Lollys eget bibliotek og egne godkjenninger er der når organisasjonen vil kjøre dem selv. [What runs where](/info/compare.html#what-runs-where) lister grensene hver sammenligning deler.

Se [How Lolly compares](/info/positioning.html) for kapabilitetssammenligningen. Leverandørnavn identifiserer produktene som sammenlignes; Lolly er ikke tilknyttet dem.
