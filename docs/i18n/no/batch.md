# Lolly Batch og Lolly Multi-edit

<a id="batch-and-multi-edit"></a>

**Lolly Batch** lager mange versjoner av ett design, som et kort på et dusin språk eller alle størrelser av en banner. **Lolly Multi-edit** gjør én endring, som en ny dato eller overskrift, i flere forskjellige lagrede design.

Begge kjører på enheten din og eksporterer gjennom den samme gjengivelsesveien som verktøyene.

::: cols
## Batch

- Én mal, mange rader. Hver rad er ett sett med inndata og lager én fil.
- Fyll radene ved å skrive, lime inn fra et regneark eller importere en CSV.
- Ingen grense for antall rader; 50 vises per side.
- Åpnes fra **Lolly Batch** i toppfeltet i Projects (`#/batch`).

<a id="multi-edit"></a>
## Lolly Multi-edit

- To til åtte forskjellige lagrede design, side om side som levende kort.
- Ett sidepanel redigerer inndataene de deler, deretter hvert korts egne.
- Hvert design lagres tilbake der det kom fra.
- Åpnes fra **Edit together** i markeringslinjen i Projects.
:::

<!--i:eti-table-->
## Lag mange versjoner av ett design

Åpne **Projects**-visningen og trykk **Batch** i toppfeltet. Rutenettet starter med én rad. Velg en mal i den raden, og dupliser deretter raden eller lim inn data fra et regneark. Når Batch åpnes fra en mappe, tar det deg tilbake til den mappen.

![Batch med et nytt rutenett: filnavnet og radverktøyene øverst, og den første radens malliste åpen med verktøyene du kan velge](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Fyll radene.** Skriv i en celle eller lim inn en blokk fra Excel, Google Sheets eller et annet regneark. **Import CSV** legger til rader eller erstatter batchen. Når du limer inn i en celle med eksportinnstillinger, spør Lolly hvilken inndata hver innlimte kolonne skal fylle. **Export CSV** skriver rutenettet til fil. Åpne **Columns** under rutenettet for å vise flere inndata, eller bredde, høyde, enhet og DPI per rad. **Fill**-popoveren for en tall-, tekst- eller valgkolonne har også en **Design token**-del som knytter ett token til alle radene i kolonnen ([Knytt til mange dokumenter samtidig](/info/token-workflows.html#link-many-documents-at-once)).

**Angi utdata.** Verktøylinjen angir zip-filens navn, **Default format**, enheter og DPI for alle radene. Formatmenyen er eksportpanelets grupperte liste over formatene katalogen tilbyr og nettleseren støtter. En rad med eget format, egen størrelse eller eget filnavn beholder sin egen innstilling.

**Gjengi.** **Render all** eksporterer alle radene til én `.zip`. Når rader er valgt, virker **Render selected**, **Export selected CSV** og **Print selected rows** bare på disse radene. Fjern markeringen for å arbeide med hele batchen igjen. **Print sheet** legger radene ut på et ark som kan skrives ut. **Batch activity** rapporterer hver import og gjengivelse og kan foldes sammen.

**Behold batchen.** **Sessions** lagrer alle radene i rutenettet som en navngitt batchøkt, uansett hva som er valgt. Økten åpnes igjen fra Projects. **Folders…** i samme meny åpner en Projects-mappe som rader, én per lagret økt; hvert filnavn inneholder mappestien.

::: details Velge rader og celler
Velg rader med avkrysningsboksene, eller Shift-klikk på en avkrysningsboks for et område. Avkrysningsboksen i toppfeltet velger gjeldende side, og **Select all *N* rows** tar også med radene på andre sider. Markeringene beholdes når du bytter side. **Edit input**, **Duplicate** og **Remove** virker på de valgte radene, og **Undo remove** gjenoppretter radene som sist ble fjernet. Fra en celle med fokus velger Shift+Space den raden, og Escape fjerner markeringen.

Dra over celler, Shift-klikk på en celle eller bruk Shift+piltaster for å velge et rektangel. **Copy cells**, eller Ctrl+C / Command+C, kopierer verdiene for et regneark. Ctrl+A / Command+A fra en celle med fokus velger alle synlige kolonner på alle sider; fra en rads avkrysningsboks velger samme snarvei alle radene. Å velge celler lar avkryssede rader forbli avkrysset. Dobbeltklikk på en celle eller trykk Enter for å redigere teksten. Lim inn et rektangel fra utklippstavlen, eller lim inn én verdi for å fylle alle valgte celler; tomme celler og tekst over flere linjer beholder posisjonene sine.
:::

### Fargevarianter og temaer per rad

Hver rad beholder sine egne temavalg: lyst eller mørkt, og en fargevariant når designsystemet har dem. En rad som åpnes fra Projects, en mappe eller en lagret batch, gjengis og forhåndsvises med valgene økten ble lagret med. Utskriftsarket, en duplisert rad og en utfylt rad beholder dem.

En CSV har valgene i en `_themes`-kolonne etter størrelseskolonnene. Kolonnen har samme JSON som lenkeparameteren `_themes`, for eksempel `{"":"dark","colourway":"beach"}`. En tom celle, eller `{}`, betyr designsystemets standardverdier. Kolonnen skrives bare når en rad har valg. Ved import oppføres en celle som ikke inneholder gyldige temavalg som et problem, og raden gjengis med standardverdiene.

::: note Angi valgene for en rad i CSV-en
Rutenettet har ennå ingen kontroll for å endre valgene for en rad, så angi dem i CSV-en eller i den lagrede økten.
:::

### Et språk for hver rad

Et verktøy som skriver sin egen tekst, som Certificate, kan ta imot en `language`-kolonne med en kort språkkode som `de`, `ja` eller `ar`. Hver rad skriver da teksten og datoen på det språket. Arabiske og urdu-rader settes opp fra høyre mot venstre. En tom celle følger appens språk. Et språk Lolly ennå ikke har en oversettelse for, skrives på engelsk, inkludert datoen, så et sertifikat blir aldri halvt oversatt.

### Batch eller Render folder

For å gjengi lagrede økter på nytt, velger du dem i Projects og bruker **Render selection**, eller **Render folder** for en hel mappe. [Finn og gjenopprett arbeidet ditt](/info/find-your-work.html#find-something-you-saved) dekker begge.

<!--i:eti-layers-->
## Rediger flere lagrede design sammen

Kryss av mellom to og åtte lagrede økter i **Projects** og velg **Edit together** fra markeringslinjen. De åpnes side om side som levende kort på `#/multi?s=<slot>,<slot>…`. Hvert kort er en faktisk gjengivelse av økten og viser hva som blir eksportert.

Ett sidepanel styrer dem alle:

- <!--i:sliders--> **Shared** kommer først: alle inndata som to eller flere av øktene definerer på samme måte (samme ID, type og begrensninger, regelen batchrutenettet bruker for kolonnene sine). En endring i en felles kontroll når alle økter som definerer inndataen, direkte på hvert kort. To økter fra samme verktøy deler alt; to forskjellige verktøy deler bare inndataene de har til felles. **Input actions**-menyen på Shared-kortet knytter et designtoken til alle økter som definerer inndataen.
- <!--i:document--> Under Shared-kortet inneholder **ett sammenfoldet kort per økt** alle øktens egne inndata, som i verktøyets eget sidepanel, med en kompakt eksportblokk: **Format**, **W** / **H**, **Unit**, **DPI** og **Download**. Denne Download lagrer økten først og gjengir deretter filen med samme filnavn, format og Content Credentials som den ville fått fra verktøyet.
- <!--i:search--> **Filter inputs…** øverst begrenser kontrollene på alle kortene samtidig.

Klikk på et kort (eller trykk Enter på kortet) for å åpne øktens kort i sidepanelet. **Save all** skriver hver økt tilbake til sin egen lagringsplass. **Download all** lagrer først og gjengir deretter settet til én zip, slik **Render selection** gjør i Projects, og tilbyr valgfri passordlås.

Hvert kort tegnes med temavalgene til sin egen økt, også et verktøy som er plassert inne i designet. Appen rundt kortene beholder sine egne farger. **Save all**, nedlastingene, **Batch grid** og **Send to Print Sheet** beholder valgene til hver økt.

### Begrensninger

- **Maksimalt åtte.** Hvert kort starter sitt eget aktive kjøremiljø, og åtte kort reagerer fortsatt raskt. En lenke som ber om flere, eller om en økt som ikke lenger finnes, sier fra og laster ikke inn settet delvis.
- **Lenken er lokal.** Den angir dine egne lagringsplasser og åpner det settet på nytt på denne enheten. Den er ikke en delingslenke.
- **For større sett** velger du **Edit as sheet** i samme markeringslinje. Det åpner utvalget som rader i batchrutenettet (`#/batch?s=…`), uten størrelsesgrense og uten krav om samme verktøy. Mapper holdes utenfor begge: åpne en mappe i rutenettet med **Sessions → Folders…**, eller gjengi en med **Render folder** i Projects.
- **Søk når ikke Lolly Multi-edit.** Det er den eneste visningen søkefeltet ikke dekker.

<!--i:eti-map-pin-->
## Veien videre

- **[Eksporter en fil](/info/exporting.html)**: formatene, størrelsene og utskriftsinnstillingene hver rad kan bruke.
- **[Maler](/info/templates.html)**: utgangspunkter som gir en god første rad.
- **[Finn og gjenopprett arbeidet ditt](/info/find-your-work.html)**: Projects, mapper og gjengivelse av det du har lagret.
