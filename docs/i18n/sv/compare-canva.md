# Lolly och Canva

_Senast kontrollerad: 28 september 2026._

Lolly skapar grafik, inlägg för sociala medier, presentationer och layouter i varumärkets stil i webbläsaren. Tillsammans med [lolly.work](https://lolly.work) stöder det också delade projekt, samarbete i realtid i arbetsflöden, godkända resurser och organisationspolicyer.

## Där de överlappar

Båda låter någon utgå från en mall och ta fram en färdig grafik utan att vara designer. Båda stöder teamarbetsflöden och varumärkeskontroller: [Canva paketerar dessa i sina företagsplaner](https://www.canva.com/canva-business/); Lolly skiljer de kreativa apparna från organisationstjänsten.

Lolly körs fristående på din enhet utan konto. lolly.work lägger till SSO, SCIM-provisionering, roller, delade kataloger, godkännanden och användningsrapportering när din organisation behöver det. Det är en del av Lolly-projektet, driftsätts separat och är öppen källkod under MPL-2.0, precis som Lolly självt.

## Mallar och teamarbete

Canva kombinerar ett stort mall- och bildbibliotek, appar och hostade teamarbetsflöden i en enda tjänst. Det färdiga innehållet och den hanterade upplevelsen kan vara användbara när du väljer utgångspunkt. Se [Canvas mallar](https://www.canva.com/templates/) och [appmarknadsplats](https://www.canva.com/apps/).

Lollys verktyg kodar tillåtna ändringar och kan återanvändas i webbläsaren, skrivbordsappen eller CLI. En design kan bli ett [verktyg med regler](/info/create-a-tool.html), och samma verktyg kan ge många utdata från en tabell med värden. lolly.work hanterar åtkomst, delat arbete och policyer kring de verktygen.

Redigering i realtid finns både via [privata collabs](/info/collaborate.html), som ansluter två enheter direkt, och via arbetscollabs genom en organisations lolly.work-instans. Arbetscollabs omfattar delad redigering, markörer och sparade teamsessioner. Den nuvarande serverdriftsättningen använder en enda samarbetsnod; dess skala och driftshistorik skiljer sig från Canvas etablerade tjänst.

## Var arbetet finns

Fristående Lolly behåller skapande och export på enheten och kan fungera offline när dess resurser finns tillgängliga. Samarbete i arbetsflöden, teamlagring och serverrendering använder organisationens konfigurerade tjänster. Det här driftsättningsvalet är skillnaden: en organisation kan driva båda delarna av Lolly själv, utan programvarulicensavgift per användare, medan den betalar för sin egen hosting och administration.

Content Credentials är valfria för exporter som stöds. lolly.work kan signera serverutdata med en konfigurerad organisationsidentitet; en verifierare måste lita på den identiteten innan undertecknaren visas som betrodd. Se [Content Credentials Identity](/info/content-credentials-identity.html) och [översikten över den kombinerade lösningen](/info/compare.html).

Canva är ett varumärke som tillhör sin ägare. Den här sidan beskriver var de två lösningarna överlappar och är inte knuten till Canva.
