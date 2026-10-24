# Profiler

Ange ditt namn, dina kontaktuppgifter och ditt porträtt en gång, så fyller varje verktyg som byggts för att använda dem i dem åt dig: en e-postsignatur, en namnbricka, ett talarkort. Den lilla posten är din **profil**, och den finns på din enhet.

Din profil håller också det du bygger upp medan du arbetar: sparade sessioner, uppladdade bilder och din lokala aktivitetsräkning. Du hanterar den under **Settings → Preferences**; verktyg läser bara de fält de byggts för att fylla i. Fristående användning behöver inget konto, och valfri Sync, delning och organisationstjänster har var och en sina egna dataflöden, beskrivna nedan.

## Vad som finns i en profil

| Del | Vad det är |
|---|---|
| **Name** | För- och efternamn. |
| **Contact** | E-post och telefon. |
| **Location** | Stad och land. |
| **Headshot** | Ett valfritt foto, beskuret till en kvadrat och sparat som en lokal bild, för verktyg som e-postsignaturer, citatkort och organisationsscheman. |
| **Use my details to create** | Ett opt-in-reglage (det lyder **Using my details** när det är på). Det avgör om dina uppgifter följer med som upphovskredit i exporterade filer och på Batch-körningar. Det påverkar inte förifyllning; se [Hur verktyg använder din profil](#how-tools-use-your-profile). |
| **Preferences** | Ditt tema, dina tillgänglighetsinställningar och vilka delar av appen du slagit på i **Feature flags**. |
| **Your work** | Sparade sessioner med sina miniatyrer, ordnade i [Projects](/info/find-your-work.html), dina uppladdade bilder och din lokala aktivitetsstatistik. |

Inget av det är obligatoriskt. En tom profil fungerar; fyll bara i det som sparar dig från att skriva.

![Settings på fliken Preferences: inställningsrailen, och Your details med reglaget Use my details to create och fälten för namn, kontakt och plats](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&walker=1&localize=1&dark=1&filename=profile-details)

[Settings](/info/dashboard.html) kartlägger allt annat under Preferences, från utseende och emoji till lagring och offlinenedladdningar.

## Du, ett team eller en roll

Ordet "profil" antyder en fast person. I Lolly ligger det närmare ett skapandesammanhang: vem du är medan du gör just det här. Det kan ha tre former, och Lolly hanterar var och en på samma sätt.

::: cols
## Som dig själv

Standard. Ditt namn, din e-post, ditt porträtt. Ange det en gång så fyller din signatur, namnbricka och konferenslogotyp i sig själva.

## Som ett team

Ett teams gemensamma namn, en gruppbrevlåda som `events@…`, en avdelning och teamets märke. En person sätter upp och exporterar den, och alla andra läser in samma profil, så att teamets filer bär konsekventa uppgifter. En delad kiosk eller en demodator kan köra en teamprofil.

## Som en roll

En eventansvarig tre dagar om året vill ha eventbrevlådan och event-undervarumärket på namnbrickor och skyltar, och sedan sin vanliga identitet tillbaka. Behåll den rollen som en sparad profilfil, läs in den för eventet och lägg undan den efteråt.
:::

![Profilbildskontrollen, tom tills du laddar upp ett foto som sedan stannar på den här enheten](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Ddetails-section&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-side&walker=1&dark=1&filename=pd-profile-headshot&css=.profile-details-main%7Bdisplay%3Anone%7D)

::: details Profiler hos en organisation som använder Lolly Work
När du loggar in på en [organisations Lolly](/info/organisation.html) kan Lolly Work tillhandahålla verifierade profilfält från sin identitetsleverantör och fixera fält eller inställningar under organisationens policy. Ett hanterat fält är märkt i appen.

Den inloggningen styr också åtkomsten till delade projekt och tillgångar. En teamprofilfil är fortfarande en lokal fil: den ger inget organisationsmedlemskap och ersätter inget arbetskonto. **Use my details to create** styr krediten i dina exporter, inte organisationens inloggnings- eller granskningsposter. Se [Integritet](/info/privacy.html#organisation-services-with-lolly-work).
:::

## Behåll flera, använd en

En installation har en aktiv profil i taget, och det finns ingen växlare i appen. I stället är varje profil en portabel fil, samma säkerhetskopia som du skulle använda för att flytta till en ny enhet. För att kliva in i ett annat sammanhang:

::: timeline
- <!--i:download--> **Export my data** under **Settings → Storage → Move to another device** sparar den aktuella profilen som en `.zip`.
- <!--i:trash--> **Clear all my data** tömmer den här installationen.
- <!--i:upload--> **Import data…** läser in profilfilen för sammanhanget du kliver in i.
:::

Att importera utan att rensa först **slår ihop** i stället. Importerade sessioner och bilder läggs till; där båda kopiorna finns behålls den som sparades senast. Mappar, favoriter och mallar läggs till bredvid dina, och dina egna uppgifter blir kvar, förutom tomma fält, som tar filens värden. Det passar för att dra in ett teams sessioner i din egen uppsättning, men inte för ett rent brott mellan roller.

För två sammanhang samtidigt använder du en separat webbläsarprofil, ett separat användarkonto eller en andra installerad kopia av webbappen: var och en bär sin egen oberoende Lolly-profil.

![De två knapparna som flyttar en hel installation: Export my data skriver en zip, Import data läser tillbaka den](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-move%3Ediv%3Anth-of-type%282%29%2C.store-move%3Ep%3Alast-of-type%7Bdisplay%3Anone%7D&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dmove%5D%3Esummary&walker=1&format=svg&cropSelector=%5Bdata-store-group%3Dmove%5D&dark=1&filename=pd-transfer-controls)

> Behåll en fil per sammanhang och döp var och en efter vad den är, som `LollyTools-events-2026.zip` och `LollyTools-me.zip`. Filen är profilen.

[Flytta ditt arbete till en annan enhet](/info/find-your-work.html#move-your-work-to-another-device) beskriver vad filen håller, vad som stannar kvar och de andra sätten att flytta, inklusive Sync.

## Hur verktyg använder din profil

**Förifyllning.** En verktygsutvecklare markerar en indata som hämtad från din profil (`bindToProfile: "firstname"`, `"email"`, `"headshot"` och så vidare). När verktyget öppnas fylls den indatan i från din profil, och du kan åsidosätta den för en session utan att ändra profilen, om inte en organisationspolicy låser indatan. Förifyllning är en lokal bekvämlighet och sker oavsett om **Use my details** är på.

**Kredit.** När du exporterar kan dina uppgifter följa med som upphovskredit i filens metadata (PNG, PDF, SVG med flera), så att en färdig fil kan säga vem som gjorde arbetet. **Use my details to create** styr detta, och upphovspersonen på Batch-körningar. Med den av säger exporten ändå att den gjorts med Lolly, men bär ingen personlig upphovs- eller kontaktrad.

Verktygsutvecklare: se [`bindToProfile`](/info/tool-inputs.html#bindtoprofile) och [`host.profile`](/info/host-api.html#host-profile).

![Det enda reglaget Use my details to create, markerat som opt-in och av tills du slår på det](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Duse-details&width=1440&height=900&dpi=192&waitMs=1600&format=svg&cropSelector=.profile-check&walker=1&dark=1&filename=pd-use-my-details)

## Profil, designsystem och förmågor

Tre saker sitter nära varandra i Settings och är lätta att blanda ihop:

- <!--i:people--> **Profile** - du, ditt team eller rollen du är i: namn, kontakt, porträtt och sparat arbete. Personlig, förvarad på enheten och portabel som en fil.
- <!--i:palette--> **Design system** - varumärket: färger, typsnitt och inställningar som varje verktyg renderas med. Delat och konsekvent snarare än personligt; se [Design System Setup](/info/brand-studio.html).
- <!--i:sliders--> **Capabilities** - vad appen kan göra: funktionerna och verktygen som är tillgängliga för dig.

En profil ändrar vem en fil kommer från; designsystemet ändrar hur filen ser ut; förmågor är det du kan göra.

Ordet har tre andra betydelser i Lolly. En **innehållsprofil** är en byggeinställning som väljer vilka verktyg och vilken katalog en installation levererar; [Ordlistan](/info/glossary.html) definierar termen. Länkparametern `profile` väljer en färgprofil för en export, till exempel ett CMYK-tryckförhållande; se [Reserved URL parameters](/info/url-parameters.html#print). En **verifierad identitet** är det valfria signeringscertifikatet som knyter din e-post till dina signerade exporter, skilt från dessa uppgifter, även om **Use my details to create** styr om någon av dem bäddas in; se [Content Credentials](/info/content-credentials-identity.html).

![Kortet Verifierad identitet, telefonbredd: väljaren för certifikatets livslängd och registreringssteget under den - identitetsprofilen, skild från dina personliga uppgifter](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

## Integritet

Din personliga profil lagras lokalt. Dina uppgifter kan färdas i en säkerhetskopia eller Sync-kopia, i innehåll du delar eller exporterar och under valfri registrering för Content Credentials. På en Lolly Work-instans är inloggning, delat arbete, telemetripolicy och granskningsposter skilda från den här lokala profilen. **Settings → Preferences → Clear all my data** rensar den här enheten; det raderar inte kopior som din lagringsleverantör eller organisation håller. Se [integritetspolicyn](/info/privacy.html).
