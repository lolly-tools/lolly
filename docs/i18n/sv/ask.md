# Fråga Lolly

Skriv en fråga så svarar Ask Lolly med det avsnitt i de här guiderna som täcker den, ord för ord, med sidan det kom från angiven och en länk **Open in docs** direkt till avsnittet. Inget genereras: svaret hämtas, citeras och tillskrivs, på din enhet.

Under det citerade avsnittet finns de platser i appen som matchar samma fråga: ett verktyg, ett hjälpverktyg, ett sparat projekt, en katalogtillgång, en inställning eller en sida i appen. Varje rad navigerar bara. Inget i ett svar ändrar en inställning, öppnar en fil eller agerar åt dig, samma regel som [Sök](/info/search.html) följer.

## Att ställa en fråga

Skriv i frågefältet längst ner i vyn och tryck Enter. Allt kortare än två tecken ignoreras. Svar staplas ovanför fältet, det nyaste sist, och du kan fortsätta fråga.

![Ask Lolly, öppet och tomt: frågefältet längst ner i vyn, med notisen att svar kommer från dokumentationen](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

Varje fråga besvaras för sig: tidigare frågor för inget sammanhang vidare, så "what about PDF?" efter en fråga om export läses som en fråga om PDF och inget annat. Ställ hela frågan varje gång.

Det första ordet i din fråga avgör vad som leder svaret:

| Du börjar med | Vad som leder |
|---|---|
| *where*, *find*, *open*, *show*, *go to*, *goto*, *take*, *jump*, *navigate*, *switch* | platserna i appen som matchar |
| *make*, *create*, *generate*, *build*, *design*, *convert*, *resize*, *compress*, *remove*, *strip*, *export*, *render*, *add* | verktygen som matchar |
| allt annat - inklusive *how do I* och *what is* | dokumentationsavsnittet, som är standard |

Båda hälfterna hämtas alltid, så en feltolkad fråga ändrar ordning på ett svar i stället för att förlora halva svaret.

Matchningen släpper de vanliga frågeorden (*how*, *do*, *I*, *the*, *my*) och rankar ett avsnitt efter hur många av dina kvarvarande ord det täcker, sedan efter var de matchade: en rubrik väger tyngre än brödtext. Matchningen sker på delsträng, utan hänsyn till versaler och accenter, så ett stavfel rättas inte. När inget matchar säger Ask det och pekar på dokumentationsindexet i stället för att hitta på ett svar.

**Better matching** är valfritt. Efter ditt första svar kan Ask erbjuda en liten matchningsmodell, med dess nedladdningsstorlek, som hjälper till att matcha en fråga mot en guide som använder andra ord för samma sak. Den laddas bara ner när du går med på det, körs på den här enheten och ändrar bara vilka avsnitt som rankas först: svaret är fortfarande dokumentationens egna ord. Du kan också ladda ner den från **Settings → Preferences → Available offline**, där den listas som **Ask matching model** ([Available offline](/info/dashboard.html#available-offline)).

## Vad som kommer tillbaka

Ett svarskort sätts ihop i fast ordning:

1. **Själva avsnittet**, renderat från dokumentationskällan - stycken, listor, tabeller, kod och citat, med levande länkar i appen och till `/info`. Ett långt avsnitt begränsas med en **Show more** som öppnar det på plats. Bilder släpps, och en länk ut till en annan webbplats renderas som vanlig text i stället för som ett ankare.
2. **Hänvisningen** - *Sida › Rubrik* - och länken **Open in docs** till exakt det avsnittet.
3. **Mer i dokumentationen** - upp till fyra andra avsnitt som matchade, som länkar.
4. **Raderna i appen**, under samma gruppnamn som Sök använder.

Den fullständiga texten kommer från den rena markdown-tvillingen som varje dokumentationssida publicerar på `/info/<slug>.md`, och de tvillingarna finns bara på engelska. På ett annat språk - och på de få sidor som inte byggs från markdown - faller svaret tillbaka på det korta utdraget i sökindexet i stället för hela avsnittet. Hänvisningen och länken **Open in docs** finns där i båda fallen och pekar på sidan på ditt eget språk.

## Var den finns

Vägen är `#/ask`. Den har ingen flik och ingen ruta i rutnätet för Utilities; vägarna in är sökfältet och själva adressen.

- <!--i:search--> **Från sökning.** Varje resultatpanel har en rad **Ask Lolly: *din fråga*** allra längst ner, under de konkreta träffar som de andra grupperna hittade. Den lämnar över frågan som `#/ask?q=…`, och vyn ställer frågan en gång vid ankomsten. De överlämnade orden kommer med gemener och utan skiljetecken, så förfina dem i frågefältet om du behöver.
- <!--i:link--> **Från en länk.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` öppnar vyn med den frågan redan ställd. Hashen är bara startvärdet: frågor du skriver efteråt besvaras på plats och skriver aldrig om adressen.

Sökfältet viker undan i den här vyn, eftersom frågefältet tar Enter, och tillbaka-pillret för dig till där du kom ifrån.

Svaren på skärmen varar under den här sessionen: de finns kvar om du navigerar bort och kommer tillbaka, och en omladdning rensar dem. Inget skrivs till lagring, så det finns ingen historik att hantera.

## Offline

Svar sätts ihop av två statiska filer som dokumentationswebbplatsen redan publicerar: sökindexet per språk och sidans markdown-tvilling. Båda hämtas med namn, så Ask fortsätter fungera utan anslutning när de väl är cachade. Att läsa guiderna i appen cachar dem allteftersom, och **Guides & docs** under [Available offline](/info/dashboard.html#available-offline) tar hela webbplatsen, skärmbilder inkluderade, i en nedladdning.

Utan dem dyker dokumentationshalvan av ett svar helt enkelt inte upp, utan något fel. Raderna i appen gör det fortfarande, eftersom de matchas mot data som redan finns på enheten.

## Integritet

Din fråga lämnar aldrig enheten. Matchningen körs lokalt mot filer som hämtas med namn, så det du skrev är inte en del av någon förfrågan; det finns ingen server som ser den, inget konto den är kopplad till och ingen post av den efter att du laddat om. Se [integritetspolicyn](/info/privacy.html) för den fullständiga listan över vad appen någonsin hämtar eller skickar.

---

**Relaterat:** [Sök](/info/search.html) för fältet som lämnar över frågor. [Använda Lolly](/info/using.html) för resten av appen. [Settings](/info/dashboard.html#available-offline) för att först ta dokumentationen offline.
