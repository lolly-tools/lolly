# Kreativa rättigheter, krediter och vad som förblir ditt

Du ska kunna använda bra arbete gjort av andra människor utan att bli expert på licensiering, och utan att i tysthet utelämna de som gjorde det. Så Lolly håller reda på källan till varje verk den använder, läser den licens som registrerats för det, räknar ut vad den licensen kräver av den användning du faktiskt gör, gör den del ett program kan göra och namnger den del bara du kan göra.

Inget av detta är juridisk rådgivning och inget av det är ett utlåtande om ditt projekt. Lolly registrerar fakta, tillämpar en liten uppsättning regler som lästs från licensernas egna juridiska texter, och visar sitt tillvägagångssätt. En licens med villkor är ett normalt, tillåtet val. Den presenteras aldrig som en trasig tillgång.

## Tre fakta, hållna isär

"CC BY 4.0", "den här användningen behöver en kredit" och "krediten finns i filen du just laddade ner" är tre olika påståenden, och Lolly håller isär dem:

- **Bevis** är vad en källa deklarerade, registrerat som det hittades, med vem som sa det och var det lästes. En senare import skriver aldrig över en tidigare post.
- **Skyldighet** är vad de granskade reglerna gör av det beviset för en användning, en leveransväg och en målgrupp. Delningsvillkor förblir villkorade medan du arbetar privat.
- **Leverans** är vad de färdiga byten faktiskt bär, uppmätt genom att läsa dem tillbaka. Lolly säger att krediter är inkluderade först efter att en läsare har hittat dem i den levererade filen.

## Var du möter detta först

Emoji-uppsättningarna är vardagsfallet. Twemoji är CC BY 4.0, så en rubrik med en emoji i sig exporteras med konstverket krediterat och inget kvar för dig att göra. Båda OpenMoji-uppsättningarna är CC BY-SA 4.0, så att omfärga ett av deras tecken med en varumärkesbehandling är en bearbetning, och att dela den bearbetningen ber dig välja en kompatibel licens en gång. Att välja uppsättningen blockeras aldrig, och uppsättningskontrollen namnger licensen där du väljer den. Samma regler gäller för en katalogillustration, en LUT, ett typsnitt och allt annat registrerat verk.

## Orden Lolly använder

Ett och samma vokabulär i exportpanelen, i Verify, på kommandoraden och i maskinresultatet.

| Vad du ser | Vad det betyder |
|---|---|
| Källkrediter kommer att inkluderas. | Krediten är förberedd och vägen kan bära den. Inget har skrivits än, så detta är inte ett framgångsmeddelande. |
| Krediter inkluderade i den här filens metadata. | De levererade byten lästes tillbaka, autentiseringsuppgiften verifierades och varje obligatorisk källa hittades i den. |
| Krediter och autentiseringsuppgifter finns i nedladdningspaketet. | Krediten färdas som en medföljande fil bredvid artefakten. Håll dem tillsammans när du för dem vidare. |
| Lägg till den här krediten i inläggets beskrivning. | Den valda vägen bär varken en autentiseringsuppgift eller en läsbar kredit, så kredittexten är din att klistra in. |
| Om du delar den här bearbetningen behöver den en kompatibel licens. | En ShareAlike-källa ändrades och resultatet är på väg någon annanstans än privat användning. Att välja är en enda åtgärd, inte en dialogruta per placering. |
| Källicens ej registrerad. | Inget registrerades för den här källan. Det är en lucka att fylla, inte ett fynd mot verket. |
| Villkor registrerade, ännu inte tolkade. | Identifieraren är igenkänd och dess villkor är listade, och ingen regel här läser dem. Inget automatiskt godkännande, inget automatiskt förbud. |
| Två licensdeklarationer skiljer sig åt. | Två poster namnger olika licenser och inget har avgjort vilken rättighet som gäller. |
| Ingen obligatorisk kredit under den registrerade CC0-dedikationen. | Dedikationen kräver ingenting. En artighetskredit erbjuds ändå. |
| Krediterna finns inte i filen som levererades. | En kredit utlovades, återläsningen hittade den inte, och filen är fortfarande din. Exportera igen, eller använd kredittexten för hand. |

Lolly använder inte "copyright verified", "legally safe", "fully cleared" eller "rights cleared", och det finns ingen enda grön licensbadge någonstans i produkten. De orden skulle hävda något som inget program kan kontrollera.

## Licenserna Lolly har granskat

Regelversion `rights-rules-2026-09-13.2`. Varje regel nedan lästes från licensens egen juridiska text, och avsnittet den kom från citeras bredvid den i `engine/src/rights-profiles.ts` såväl som här. En version och en port hålls som registrerade: en CC BY 3.0-deklaration behåller sin egen version i stället för att rapporteras som 4.0 bara för att appens väljare föredrar 4.0.

| Licens | Vad den kräver av en användning Lolly kan göra | Läst från |
|---|---|---|
| CC BY 4.0 | Upphovspersonen, titeln, copyrightnoteringen, licensnamnet och länken, källänken och en indikation på ändringar, var och en när källan tillhandahöll den. Ingen användning är utesluten, kommersiell användning inräknad. | [Juridisk text](https://creativecommons.org/licenses/by/4.0/legalcode.en), avsnitten 2(a)(1) och 3(a) |
| CC BY-SA 4.0 | Samma kredit. Dessutom, om du delar en bearbetning, går den ut under en kompatibel licens: CC BY-SA 4.0, Free Art License 1.3 eller GPL-3.0-or-later, som bara går åt ett håll. Dessa tre bärs som data från Creative Commons lista, aldrig matchade efter namn. | [Juridisk text](https://creativecommons.org/licenses/by-sa/4.0/legalcode.en), avsnitten 3(a) och 3(b); [listan över kompatibla licenser](https://creativecommons.org/compatible-licenses/) |
| CC0 1.0 | Ingenting. Dedikationen bär inget villkor, så Lolly erbjuder en artighetskredit och presenterar aldrig en som obligatorisk. | [Dedikationen](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en), avsnitten 2 och 3; [CC FAQ](https://creativecommons.org/faq/) om kreditering |
| CC-PDDC | Ingenting. Det som registreras är själva påståendet och vem som gjorde det, eftersom en certifiering är en parts uttalande snarare än ett bevis. | [Dedikationen och certifieringen](https://creativecommons.org/licenses/publicdomain/), styckena |
| Apache License 2.0 | Noteringarna från källan och NOTICE-filens attributionstext följer med ett distribuerat verk. En körtidsanvändning kräver ingenting. En licens som kräver en noteringstext och ett verk som inte bär någon rapporteras som en lucka. | [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0), avsnitt 4, villkor 1 till 4 |
| MIT | Copyrightraden och tillståndsnoteringen följer med kopior och väsentliga delar. Körtids- och referensanvändningar kräver ingenting. | [MIT](https://opensource.org/license/mit), villkoret om tillståndsnotering |
| SIL OFL 1.1 | Att rendera text med typsnittet kräver ingenting av texten. Att föra typsnittsfilen vidare bär licensen, copyrightnoteringen och regeln om reserverade namn. | [OFL 1.1](https://openfontlicense.org/open-font-license-official-text/), villkoren 2, 3 och 5; [OFL FAQ](https://openfontlicense.org/ofl-faq/) om dokument |

### Registrerat, inte tolkat

CC BY-NC, CC BY-ND och kombinationerna NC-SA och NC-ND är igenkända, deras villkor är listade, och ingen regel här läser dem. De rapporterar `licence.unknown` med en rad som namnger villkoren. Ett kommersiellt sammanhang kan inte läsas av ett pris eller ett konto, och varje kombinerad text behöver sin egen granskning innan en regel rör den.

Tre ytterligare ärliga svar, inget av dem är ett tillstånd:

- En `LicenseRef-`-identifierare kommer tillbaka som sig själv. Den pekar på en lagrad definition och är aldrig proprietär genom stavning.
- En deklaration som ingenting känner igen kommer tillbaka otolkad, med originaltexten bevarad bredvid den.
- `A OR B` är ett val som rättighetsinnehavaren erbjöd, så varje alternativ returneras och inget väljs. `A AND B` är kumulativt, och dessa regler registrerar det i stället för att läsa två profiler tillsammans.

Saknad licensinformation läses aldrig som bevis för att ett verk är fritt att föra vidare.

## Vad Lolly gör för dig

- **I katalogen.** Ett verks blad visar dess källa och upphovsperson, det kanoniska licensnamnet med originaletiketten bevarad under, en kopierbar kredit där en är registrerad och en rad som säger vad det kräver att använda det. En ruta anger kravet; den hävdar aldrig att en export har slutförts.
- **I exportpanelen.** Ett Source credits-kort visas inuti Content protection så snart en rendering använder registrerat verk, bredvid Licence du väljer för din egen export. Det visar tillståndet, kredittexten bakom Detaljer, en Copy credit-knapp och ett inbäddat kort när ett beslut återstår. Ett beslut är aldrig en blockerande dialogruta: en nedladdning som har en åtgärd kvar fortsätter, och privat arbete förblir användbart.
- **I filen.** En export som placerat registrerat verk skriver en Content Credentials-källingrediens per distinkt verk, bunden till originalbyten på deras publika adress, med upphovsperson, licensen och dess länk, källan, revisionen och ändringarna. Lolly signerar vad den observerade. Den signerar aldrig ett påstående å den ursprungliga konstnärens vägnar, och Verify säger vilket av de två som hände.
- **Efter skrivning.** De levererade byten läses tillbaka innan något säger att krediter är inkluderade. En autentiseringsuppgift som inte verifierades räknas inte som en levererad kredit.
- **I en redigerbar `.lolly`-fil.** Byte färdas bara när en granskad licens registrerar tillstånd att föra källan vidare, och paketets `CREDITS.txt` listar vad som följde med, under vilken licens, och vad som hölls tillbaka med anledningen. En oregistrerad licens hålls tillbaka. Du kan fortfarande inkludera tillbakahållet innehåll avsiktligt, och kreditfilen registrerar att det var ditt val.
- **I Verify.** En Sources-panel listar varje källa en fil registrerar, med en beräknad sammanfattning, krediten, en Copy credit-knapp, en Open source-länk som bara öppnas på begäran och de angivna gränserna för vad som inspekterades. En Check for this use-fråga ställs bara när du väljer en användning, och inget hämtas för att besvara den.
- **När du tar bort metadata.** Strippning talar om för dig hur många källkrediter filen inte längre bär, erbjuder kredittexten och erbjuder en ren fil med krediterna bredvid. Strippade byte omstämplas aldrig.

## Vad som förblir ditt

- **Ditt licensval är ditt.** Att göra anspråk på en fil separerar tre tillstånd som brukade vara ett: ingen publik licens deklarerad, en uttrycklig all-rights-reserved-notering och en faktisk publik licensbeviljning. Lolly skriver en rättighetsrad bara för de sista två, och aldrig från din profil.
- **Ditt arbete omlicensieras inte åt dig.** En källas villkor och din egen utdatadeklaration är separata poster. Ett ShareAlike-villkor gäller för den bearbetning det styr, inte automatiskt för allt annat du gjort.
- **Privat arbete förblir användbart.** Villkor som gäller vid delning väcks när delning är i sikte. Inget här blir till ett importförbud, och inget licensieringsformulär står mellan dig och dina egna filer.
- **Ett beslut kommer ihåg mot sina egna fakta.** Varje val du registrerar stämplas med ett fingeravtryck av verken, användningarna, vägen och målgruppen det gjordes om. Ändra uppsättningen, behandlingen, formatet eller målgruppen och frågan ställs igen. Det finns ingen övergripande "ignorera licenser"-brytare, eftersom att klicka bort en varning inte kan leverera en kredit eller bevilja ett tillstånd.
- **Dina uppgifter förblir separata från en tredje parts kredit.** Att ta bort din egen personliga metadata tar inte bort en krediterad konstnär, och en obligatorisk kredit är aldrig en ursäkt för att exportera dina kontaktuppgifter.

## På kommandoraden

En rendering skriver ut ett `Rights:`-block till standard error när utvärderingen har en obligatorisk kredit eller ett problem. Det bär statusen, en rad per problem som `code - summary`, vad den levererade filen lästes tillbaka som och kredittexten att klistra in.

```
Rights: actions-required
  licence.adaptation-choice - If you share this adaptation, it needs a compatible licence.
  Credential intact. It records 1 source. The exporter recorded it; the source did not sign a credential of its own.
  Credits included in this file's metadata.
  "water wave (OpenMoji Color 17.0.0)" by Vanessa Boutzikoudi (OpenMoji), CC BY-SA 4.0 https://creativecommons.org/licenses/by-sa/4.0/, source https://raw.githubusercontent.com/hfg-gmuend/openmoji/f9fc506a3f913be9897ab0181d611d4c910a4104/color/svg/1F30A.svg, changes: recoloured.
```

Dessa två påståenden är oberoende, vilket är poängen med att hålla dem isär: krediten finns i filen, och ett licensbeslut återstår fortfarande innan filen delas. Filen skrivs oavsett.

| Status | Betydelse | Exit |
|---|---|---|
| `ready` | Inget väntar på en person. | 0 |
| `actions-required` | Ett beslut återstår innan filen delas. Filen skrivs ändå. | 4 |
| `use-not-covered` | En granskad regel säger att licensen inte täcker den här användningen. | 4 |
| `unknown` | De enda problemen är luckor: en licens som inte registrerades, eller villkor som inte är tolkade. | 0 |
| `delivery-failed` | Satt av ett kvitto, aldrig av en utvärdering: en utlovad kredit hittades inte i de levererade byten. Exportpanelen visar det; CLI:t rapporterar samma fakta i sin återläsningsrad i stället. | skrivs inte ut |

Exit 4 är koden det här CLI:t redan ger en skyddande kontroll som sagt nej. Den är avsiktligt inte 3, vilket betyder "försök igen på en annan körare", och ett licensbeslut kommer att vänta på varenda körare som finns.

`--rights=private` anger att den här renderingen inte levereras till någon. Blocket skrivs fortfarande ut och krediten finns fortfarande där att kopiera; det som ställs åt sidan är villkoret som gäller vid delning, och inget leveranspåstående registreras. Det finns ingen flagga för att ignorera ett villkor: `--rights=ignore` är ett användningsfel.

Problemkoderna är stabila och maskinläsbara, oberoende av den översatta texten:

`attribution.source-missing`, `attribution.delivery-missing`, `licence.adaptation-choice`, `licence.use-not-covered`, `licence.grant-conflict`, `licence.unknown`, `source.redistribution-unknown`, `credential.ingredient-missing`.

Över MCP returnerar `lolly_verify` en `rights`-payload med sammanfattningen, en rad per registrerad källa och de angivna gränserna; ett webbläsarfritt `lolly_render` returnerar `status`, `issues`, `credits`, `fingerprint` och en `creditsInFile`-flagga som mäts genom att läsa byten tillbaka.

## Var reglerna bor

Fyra motormoduler, alla rena: inget nätverk, ingen klocka, inget filsystem. Regeldatan är versionerad och finns i repositoryt, hämtas aldrig.

| Modul | Vad den innehåller |
|---|---|
| `engine/src/rights-profiles.ts` | Identifierartabellen, den minimala SPDX-uttrycksläsaren, de granskade profilerna med sina citat och den enda regeln för en länk en kredit får skriva ut. |
| `engine/src/rights-evaluate.ts` | Klassificering, problem, attributionsplanen och fingeravtrycket. Deterministisk: samma fakta i en annan ordning ger samma svar. |
| `engine/src/rights-attribution.ts` | Läsbara krediter, de medföljande filerna, källingredienserna och kvittot uppmätt efter skrivning. |
| `engine/src/rights-report.ts` | En verifierad autentiseringsuppgift läst tillbaka som de tre frågorna Verify ställer. |

Förväntningsfilerna i `tests/fixtures/rights/` skrevs utifrån licenstexterna snarare än utifrån utvärderarens utdata, och dess README citerar avsnittet bakom varje förväntning.

## Vad det här inte gör

Sagt rent ut, eftersom en lucka som inte namnges läses som ett löfte.

- **NC och ND tolkas inte.** Deras villkor registreras och rapporteras som okända.
- **Ingen destination bekräftas.** Lolly förbereder en bildtext; att en anslutning accepterar en förfrågan är inget bevis på att en kredit nådde en läsare, och inget här lovar att en senare uppladdning, skärmdump eller omkodning bevarar dold metadata.
- **Nativa metadatafält för kredit skrivs inte från planen.** Krediter färdas i Content Credentials och i läsbar text. IPTC- och XMP-fälten per källa för kredit fylls ännu inte i från attributionsplanen.
- **Rättelser och återkallande är inte byggda.** Att lägga till en saknad upphovsperson eller en lokal rättelse till ett registrerat verk, och att återkalla en post, har inget gränssnitt.
- **Anslutna leverantörer är inte byggda.** Köpt bildbyråmaterial, ett anpassat tillstånd och ett leverantörskonto har ingen importväg, så deras rättigheter kan bara registreras som ditt eget uttalande.
- **Organisationspolicy är inte sammansatt med dessa resultat.** Exportpolicy och licensvillkor är separata idag, och ett organisationsgodkännande är inget tillstånd från en rättighetsinnehavare.
- **Flera leveransvägar är ännu inte på den här vägen.** Att ladda ner ett katalogoriginal, en bulk-ZIP, en härledd nedladdning, Send och Copy image utvärderar eller bär ännu inte dessa krediter.
