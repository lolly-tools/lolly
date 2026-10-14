# Lolly og merkevareportaler

_Sist kontrollert: 28. september 2026._

Lolly og [lolly.work](https://lolly.work) dekker sammen opprettelses- og styringsarbeidsflytene team bruker merkevareportaler til: godkjente ressurser, låste maler, tilgangskontroll, gjennomgang og distribusjon. Sammenlign denne samlede løsningen med Bynder, Frontify, Marq eller Brandfolder når du velger hvordan folk finner merkevareressurser og lager nye.

## Opprettelse og organisasjonstjenester

Lollys motor og apper lager filene. Maler, designtokens og tillatte inndata definerer hva en person kan endre, og gjengivelsen kan bli på personens enhet. Frittstående Lolly trenger ingen konto.

lolly.work er organisasjonstjenesten i samme prosjekt, vedlikeholdt i et [eget repositorium](https://github.com/lolly-tools/lolly-work) og driftet ved siden av Lolly. Den legger til identitet, delt lagring, policy, godkjenninger og rapportering. Begge delene er åpen kildekode under MPL-2.0. Skillet gjør at en enkeltperson kan bruke Lolly uavhengig, og en organisasjon kan drifte den samlede løsningen på infrastruktur den selv kontrollerer.

## Hva den samlede løsningen tilbyr

| Behov | Lolly + lolly.work |
|---|---|
| Pålogging og provisjonering | OIDC-enkeltpålogging, flere identitetsleverandører, SCIM 2.0-brukerprovisjonering og gruppemedlemskap, og deaktivering av kontoer som tilbakekaller eksisterende økter. En identitetsleverandør som kun støtter SAML, kan kobles til via en OIDC-bro som Keycloak. |
| Godkjente maler | Lolly definerer malens redigerbare inndata; lolly.work bruker gruppesynlighet og inndatapolicyer som låser verdier, begrenser valg eller skjuler kontroller. |
| Delt ressursbibliotek | Opplastinger eid av instansen, samlinger, egendefinerte metadata og tilgangsstyrte kataloger, pluss koblinger som leser eksisterende DAM- og lagringsbiblioteker. |
| Gjennomgang | Ordnede godkjenningstrinn, kvalifiserte godkjennergrupper, kvorumsregler og funksjonsdeling; gjennomgang kan styre innsending til kataloger og levering til organisasjonens mål. |
| Ressurshistorikk og tilgjengelighet | Versjoner og tilbakerulling for ressurser eid av instansen, oppbevaring og låsing, planlagt tilgjengelighet, utløp og tilbakekalling. Tilkoblede leverandører beholder sin egen kildehistorikk. |
| Rapportering | Antall bruk og nedlastinger av ressurser, verktøy- og eksportaktivitet, dashbord og et revisjonsspor. Tilskriving av bruk følger driftens telemetripolicy; standardinnstillingen for tilskriving krever samtykke. |
| Distribusjon | Lenker som utløper og kan tilbakekalles, delte samlinger, gjestetilgang og levering til konfigurerte mål i organisasjonen. |

[Driftsveiledningene for lolly.work](https://github.com/lolly-tools/lolly-work/tree/main/docs) beskriver disse funksjonene og konfigurasjonen av dem. De er tilgjengelige funksjoner, ikke funksjoner som krever at du bygger et annet system rundt Lolly.

## Velge en portalarbeidsflyt

Etablerte portaler tilbyr administrert drift, støtte og omfattende DAM-arbeidsflyter. For eksempel kombinerer [Frontifys enterprise-DAM](https://www.frontify.com/en/solution/enterprise-digital-asset-management) ressurssøk, tilgangskontroll, godkjenningsarbeidsflyter og distribusjon. Sammenlign den nøyaktige arbeidsflyten du trenger for gjennomgang og rettigheter: Lolly tilbyr metadata, tilgangskontroll og kontroll over tilgjengelighet, mens juridisk klarering og lisensforpliktelser fortsatt krever en organisasjons egen prosess. Godkjenningskjedene er sekvensielle; de modellerer ikke vilkårlig forgrenede arbeidsflyter.

Lolly-stakken er yngre, og [statussiden for lolly.work](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) oppgir grensene for driften. Spesielt er det offentlige lolly.work-nettstedet en evalueringssandkasse. En varig organisasjonsdrift trenger vedvarende lagring og en driftsansvarlig. Egendrift har ingen programvarelisens per bruker; infrastruktur og administrasjon koster fortsatt penger.

Et eksisterende DAM kan også forbli kilden til sannhet. Katalogkoblingene i lolly.work gjør de godkjente ressursene derfra tilgjengelige i Lolly, der folk lager nye filer etter organisasjonens regler. Det er et integrasjonsvalg; Lollys eget bibliotek og egne godkjenninger er tilgjengelige når organisasjonen vil styre disse arbeidsflytene selv.

Se [Hvordan Lolly sammenlignes](/info/positioning.html) for funksjonssammenligningen og [Lolly sammenlignet, verktøy for verktøy](/info/compare.html) for resten av denne serien. Leverandørnavn identifiserer produktene som sammenlignes; Lolly er ikke tilknyttet dem.
