# Batch og Multi-edit

To jobber dukker opp når du ofte lager samme type fil. Noen ganger trenger du mange versjoner av ett design: et kort på et dusin språk, eller alle størrelser av et banner. Noen ganger har du flere ulike lagrede design og vil at én endring skal nå alle, som en ny dato eller en ny overskrift.

**Batch** gjør den første jobben og **Multi-edit** den andre. Begge kjører på enheten din og eksporterer gjennom den samme gjengivelsesveien som verktøyene selv.

::: cols
## Batch

- Én mal, mange rader. Hver rad er ett sett med inndata og lager én fil.
- Fyll radene ved å skrive, lime inn fra et regneark eller importere en CSV.
- Ingen grense for rader; 50 vises per side.
- Åpnes fra **Batch** i Projects-toppen (`#/batch`).

## Multi-edit

- To til åtte ulike lagrede design, side om side som levende kort.
- Ett sidefelt redigerer inndataene de deler, deretter hvert korts egne.
- Hvert design lagres tilbake dit det kom fra.
- Åpnes fra **Edit together** i markeringslinjen i Projects.
:::

## Lag mange versjoner av ett design

Åpne **Projects** og trykk **Batch** i toppen. Rutenettet starter med én rad: velg en mal i den, og dupliser deretter raden eller lim inn data fra regnearket ditt. Åpnet fra inne i en mappe tar Batch deg tilbake til den mappen.

![Batch på et nytt rutenett: filnavnet og radverktøyene øverst, og mallisten til den første raden åpen på verktøyene du kan velge](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Fyll radene.** Skriv i en celle eller lim inn en blokk rett fra Excel, Google Sheets eller et annet regneark. **Import CSV** legger til rader eller erstatter batchen. Når du limer inn i en celle som holder eksportinnstillinger, spør Lolly hvilken inndata hver innlimte kolonne fyller. **Export CSV** skriver rutenettet ut igjen. Åpne **Columns** under rutenettet for å vise flere inndata, eller bredde, høyde, enhet og DPI per rad.

**Sett utdata.** Verktøylinjen setter zip-ens filnavn, **Default format**, enheter og DPI for hver rad. Formatmenyen er eksportpanelets grupperte liste, som viser formatene katalogen tilbyr og nettleseren din støtter. En rad med eget format, egen størrelse eller eget filnavn beholder sin egen innstilling.

**Render.** **Render all** eksporterer hver rad til én `.zip`. Velg rader først, så virker **Render selected**, **Export selected CSV** og **Print selected rows** bare på dem; fjern utvalget for å arbeide på hele batchen igjen. **Print sheet** legger radene ut på et utskriftsark. **Batch activity** rapporterer hver import og gjengivelse, og folder seg bort for å gi tabellen mer plass.

**Behold batchen.** **Sessions** lagrer hele rutenettet som en navngitt batchøkt, som åpnes igjen senere fra Projects. Sessions lagrer alltid hver rad, uansett hva som er valgt. **Folders…** i samme meny åpner en hel Projects-mappe som rader, én per lagret økt, der hvert filnavn bærer mappestien sin.

::: details Å velge rader og celler
Velg rader med avkrysningsboksene deres, eller Shift-klikk en avkrysningsboks for et område. Avkrysningsboksen i toppen velger gjeldende side, og **Select all *N* rows** tar med radene på andre sider også. Utvalg blir stående mens du beveger deg mellom sider. **Edit input**, **Duplicate** og **Remove** virker på de valgte radene, og **Undo remove** gjenoppretter radene som ble fjernet sist. Fra en celle i fokus velger Shift+Space den raden og Escape fjerner utvalget.

Dra over celler, Shift-klikk en celle eller bruk Shift+piltaster for å velge et rektangel. **Copy cells**, eller Ctrl+C / Command+C, kopierer verdiene for et regneark. Ctrl+A / Command+A fra en celle i fokus velger hver synlige kolonne på hver side; fra en radavkrysningsboks velger den samme snarveien hver rad. Å velge celler lar avkryssede rader forbli avkrysset. Dobbeltklikk en celle eller trykk Enter for å redigere teksten. Lim inn et rektangel fra utklippstavlen, eller lim inn én verdi for å fylle hver valgte celle; tomme celler og tekst med flere linjer beholder posisjonene sine.
:::

### Fargevarianter og temaer per rad

Hver rad beholder sine egne temavalg: lys eller mørk, og en fargevariant når designsystemet har dem. En rad åpnet fra Projects, en mappe eller en lagret batch gjengis i valgene økten ble lagret i, og forhåndsvisningen åpnes i dem. Utskriftsarket, en duplisert rad og en utfylt rad beholder dem alle.

En CSV bærer valgene i en `_themes`-kolonne etter størrelseskolonnene, med samme JSON som lenkeparameteren `_themes`, for eksempel `{"":"dark","colourway":"beach"}`. En tom celle, eller `{}`, betyr designsystemets standarder. Kolonnen skrives bare når en rad har valg, så en batch uten noen eksporterer den samme CSV-en som før. Ved import blir en celle som ikke er gyldige temavalg, oppført som et problem, og raden gjengis i standardene. Rutenettet har ennå ingen kontroll for å endre valgene til en rad, så sett dem i CSV-en eller i den lagrede økten.

### Batch, eller Render folder

Batch lager mange varianter av én mal. For å gjengi økter du allerede har lagret på nytt, velg dem i Projects og bruk **Render selection**, eller **Render folder** for en hel mappe; [Find and recover your work](/info/find-your-work.html#find-something-you-saved) dekker begge.

## Rediger flere lagrede design sammen

Kryss av for mellom to og åtte lagrede økter i **Projects** og velg **Edit together** fra markeringslinjen. De åpnes side om side som levende kort på `#/multi?s=<slot>,<slot>…`. Hvert kort er en ekte gjengivelse av økten sin, så det du ser, er det som eksporteres.

Ett sidefelt styrer dem alle:

- <!--i:sliders--> **Shared** kommer først: hver inndata to eller flere av øktene deklarerer på samme måte (samme id, samme type, samme begrensninger, regelen batch-rutenettet bruker for kolonnene sine). Rediger en delt kontroll én gang, så når verdien hver økt som deklarerer inndataen, live på hvert kort. To økter av samme verktøy deler alt; to ulike verktøy deler bare inndataene de har felles.
- <!--i:document--> Under det holder **ett sammenfoldet kort per økt** alle den øktens egne inndata, like komplette som verktøyets eget sidefelt, med en kompakt eksportblokk: **Format**, **W** / **H**, **Unit**, **DPI** og **Download**. Den Download-knappen lagrer økten først, og gjengir deretter filen med samme filnavn, format og Content Credentials som den ville fått fra verktøyet.
- <!--i:search--> **Filter inputs…** øverst snevrer inn kontrollene på hvert kort samtidig, så du kan nå "overskriften" i åtte økter uten å rulle.

Klikk på et hvilket som helst kort (eller trykk Enter på det) for å åpne den øktens sidefeltkort. **Save all** skriver hver økt tilbake til sin egen plass. **Download all** lagrer først, og gjengir deretter hele settet til én zip, på samme måte som **Render selection** gjør i Projects, med det valgfrie passordlåset tilbudt underveis.

Hvert kort tegnes i sin egen økts temavalg, også et verktøy plassert inne i designet. Kort i ulike utseender ligger side om side mens appen rundt beholder sine egne farger, og **Save all**, nedlastingene, **Batch grid** og **Send to Print Sheet** beholder hver økts valg.

### Grenser

- **Åtte som mest.** Hvert kort monterer sin egen levende kjøretid, og åtte er tallet som holder seg responsivt. En lenke som ber om flere, eller om en økt som ikke finnes lenger, sier fra i stedet for å lastes halvveis.
- **Lenken er lokal.** Den navngir dine egne lagrede plasser, så den åpner det settet igjen på denne enheten. Det er ikke en delingslenke.
- **For alt større,** velg **Edit as sheet** i samme markeringslinje. Den åpner hele utvalget som rader i batch-rutenettet (`#/batch?s=…`), uten størrelsesgrense og uten regelen om samme verktøy. Mapper holdes utenfor begge: åpne en mappe i rutenettet med **Sessions → Folders…**, eller gjengi en med **Render folder** i Projects.
- **Søk når ikke Multi-edit.** Det er den ene visningen søkefeltet ikke kjenner til.

## Hvor du går videre

- **[Export a file](/info/exporting.html)**: formatene, størrelsene og trykkinnstillingene hver rad kan bruke.
- **[Templates](/info/templates.html)**: utgangspunkter som gir en god første rad.
- **[Find and recover your work](/info/find-your-work.html)**: Projects, mapper og å gjengi det du lagret.
