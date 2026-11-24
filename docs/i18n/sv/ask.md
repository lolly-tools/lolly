# Fråga Lolly

Fråga Lolly besvarar en fråga med det matchande avsnittet ur de här guiderna, citerat ord för ord, med en hänvisning till sidan och en **Open in docs**-länk till avsnittet. Inget genereras: svaret hittas och citeras på din enhet.

Under det citerade avsnittet finns platserna i appen som matchar frågan: ett verktyg, ett hjälpverktyg, ett sparat projekt, en katalogtillgång, en inställning eller en sida i appen. Varje rad navigerar bara. Inget i ett svar ändrar en inställning, öppnar en fil eller agerar åt dig, samma regel som i [Lolly Search](/info/search.html).

<!--i:eti-chat-->
## Ställ en fråga

Skriv i frågefältet längst ner i vyn och tryck på Enter. Allt som är kortare än två tecken ignoreras. Svaren staplas ovanför fältet med det senaste sist.

![Fråga Lolly, öppet och tomt: frågefältet längst ner i vyn, med noteringen att svaren kommer från dokumentationen](/t/url-shot?url=%2F%23%2Fask&width=1200&height=820&waitMs=2200&format=svg&walker=1&filename=ask-view)

::: note Varje fråga står för sig
Tidigare frågor för inte med sig något sammanhang, så ”och PDF då?” efter en fråga om export läses som en fråga enbart om PDF. Ställ hela frågan varje gång.
:::

Det första ordet i din fråga avgör vad som kommer först i svaret:

| Du börjar med | Vad som kommer först |
|---|---|
| *var*, *hitta*, *öppna*, *visa*, *gå till*, *gåtill*, *ta*, *hoppa*, *navigera*, *byt* | platserna i appen som matchar |
| *gör*, *skapa*, *generera*, *bygg*, *designa*, *konvertera*, *ändra storlek*, *komprimera*, *ta bort*, *rensa*, *exportera*, *rendera*, *lägg till* | verktygen som matchar |
| allt annat - inklusive *hur gör jag* och *vad är* | dokumentationsavsnittet, som är standard |

Båda halvorna hämtas alltid, så en feltolkad fråga ändrar bara ordningen på svaret.

Matchningen tar bort vanliga frågeord (*hur*, *gör*, *jag*, *den*, *min*). Den rangordnar ett avsnitt efter hur många av dina andra ord det täcker och sedan efter var de matchade: en rubrik väger tyngre än brödtext. Matchningen sker på delsträngar och bortser från skiftläge och accenter, så ett stavfel rättas inte. När inget matchar säger Fråga Lolly det och hänvisar till dokumentationsindexet.

**Better matching** är valfritt. Efter ditt första svar kan Fråga Lolly erbjuda en liten matchningsmodell med angiven nedladdningsstorlek. Modellen matchar en fråga med en guide som använder andra ord för samma sak. Den laddas bara ner när du godkänner det, körs på den här enheten och ändrar bara vilka avsnitt som rangordnas först. Svaret är fortfarande dokumentationens egna ord. Du kan också ladda ner den som **Ask matching model** under **Settings → Preferences → Available offline** ([Tillgängligt offline](/info/dashboard.html#available-offline)).

<!--i:eti-clipboard-->
## Vad du får tillbaka

Ett svarskort har en fast ordning:

1. **Själva avsnittet**, renderat från dokumentationens källa: stycken, listor, tabeller, kod och citat, med aktiva länkar till appen och `/info`. Ett långt avsnitt avslutas med **Show more**, som öppnar resten på plats. Bilder utelämnas och en länk till en annan webbplats visas som vanlig text.
2. **Källhänvisningen** - *Sida › Rubrik* - och **Open in docs**-länken till just det avsnittet.
3. **More in the docs** - upp till fyra andra avsnitt som matchade, som länkar.
4. **Raderna med träffar i appen**, under samma grupprubriker som Search använder.

Den fullständiga texten kommer från den markdown-motsvarighet som varje dokumentationssida publicerar på `/info/<slug>.md`. De motsvarigheterna finns bara på engelska. På andra språk, och på de få sidor som inte byggs från markdown, visar svaret i stället det korta utdraget ur sökindexet. Källhänvisningen och **Open in docs**-länken pekar fortfarande på sidan på ditt språk.

<!--i:eti-map-pin-->
## Var du hittar det

Sökvägen är `#/ask`. Den har ingen flik och ingen ruta i Utilities-rutnätet. Du når vyn från sökfältet eller via dess adress.

- <!--i:search--> **Från sökningen.** Varje resultatpanel avslutas med en rad **Ask Lolly: *din sökfråga*** under de andra gruppernas resultat. Raden öppnar `#/ask?q=…` och vyn ställer frågan en gång när den öppnas. Orden kommer in med små bokstäver utan skiljetecken, så justera dem i frågefältet om det behövs.
- <!--i:link--> **Från en länk.** `#/ask?q=how%20do%20I%20export%20a%20transparent%20png` öppnar vyn med den frågan redan ställd. Hash-delen anger bara den första frågan. Frågor som du skriver efteråt besvaras på plats och ändrar aldrig adressen.

Sökfältet döljs i den här vyn eftersom frågefältet använder Enter. Tillbaka-pillret tar dig dit du kom ifrån.

Svaren finns kvar under den här sessionen: de finns fortfarande där om du lämnar vyn och kommer tillbaka, och en omladdning rensar dem. Inget skrivs till lagringen, så det finns ingen historik att hantera.

<!--i:eti-download-->
## Offline

Svaren kommer från två statiska filer som dokumentationswebbplatsen publicerar: sökindexet för varje språk och sidans markdown-motsvarighet. Båda hämtas med namn, så Fråga Lolly fungerar utan anslutning när de väl är cachade. När du läser guiderna i appen cachas de. **Guides & docs** under [Tillgängligt offline](/info/dashboard.html#available-offline) hämtar hela webbplatsen, inklusive skärmbilder, i en nedladdning.

Utan de här filerna visas inte dokumentationshalvan av ett svar och inget fel visas. Raderna med träffar i appen visas fortfarande, eftersom de matchas mot data som redan finns på enheten.

<!--i:eti-lock-->
## Integritet

Din fråga lämnar aldrig enheten. Matchningen körs lokalt mot filer som hämtas med namn, så det du skrev ingår inte i någon begäran. Ingen server ser din fråga, inget konto har den och ingen registrering finns kvar efter att du laddar om. [Integritetspolicyn](/info/privacy.html) listar allt som appen hämtar eller skickar.

---

**Relaterat:** [Lolly Search](/info/search.html) för fältet som lämnar över frågor. [Använda Lolly](/info/using.html) för resten av appen. [Lolly-inställningar](/info/dashboard.html#available-offline) för att först göra dokumentationen tillgänglig offline.
