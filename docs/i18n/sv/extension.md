# Webbläsartillägg

Tillägget **Lolly URL Screenshot** låter webbappen ta en skärmdump av vilken webbsida som helst inifrån din webbläsare. Utan det behöver man skrivbordsappen för att fånga en URL - en webbläsarsida kan inte läsa pixlar från en annan sajt på egen hand. Tillägget kan, med samma fångst som skrivbordsappen använder.

Den gör ett annat jobb på samma sätt: läser en enskild sida du anger så att Brand Studio kan dra ut ett varumärke från en levande webbplats. Båda täcks nedan.

Det körs på Chromium-baserade webbläsare: **Chrome, Edge, Brave, Arc, Opera** - Chrome 111 eller senare.

Tills det är installerat öppnas **URL Screenshot** ändå så att du kan komponera en bild, och en notis högst upp i verktygets kontroller säger vad som saknas.

![URL Screenshot-verktygets notis som erbjuder tillägget, visad när fångst till fil saknar en värd att köra på](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23capture-hint-notice&dark=1&filename=exp-url-shot-notice)

Varje kontroll är levande medan du väntar: mål-URL:en, rulldjupet, avvaktningsfördröjningen, beskärningsmarginalerna och färgändringen. Endast själva fångsten behöver en värd.

![URL Screenshot-kontrollerna med en mål-URL, rulldjup, avvaktningsfördröjning och beskärningsmarginaler, alla användbara innan tillägget finns](/t/url-shot?url=%2F%23%2Ftool%2Furl-shot%3Furl%3Dhttps%3A%2F%2Flolly.tools%26scrollDepth%3D0.3%26waitMs%3D1200&width=1440&height=2200&dpi=192&waitMs=2400&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&walker=1&dark=1&filename=fq-url-shot-controls)

## Installera

### Från Chrome Web Store

*Kommer snart.* När det är publicerat installerar du det med ett klick och laddar sedan om Lolly.

### Ladda in det själv (utvecklare)

Tillägget finns i repot på `shells/chrome-extension/`.

1. Öppna `chrome://extensions`.
2. Slå på **Developer mode** (uppe till höger).
3. Klicka på **Load unpacked** och välj mappen `shells/chrome-extension/`.
4. Ladda om Lolly - **URL Screenshot** fungerar nu i webbläsaren.

## Hur det fungerar

- Ett litet skript talar om för Lolly att tillägget finns, så att verktyget **URL Screenshot** slås på automatiskt - ingen konfiguration.
- När du renderar öppnar tillägget målsidan i en bakgrundsflik, fångar den via DevTools Protocol (samma `Page.captureScreenshot` som skrivbordsappen använder), stänger sedan fliken och lämnar tillbaka bilden.
- Det körs helt i din webbläsare, på ditt nätverk - så att fånga `localhost` eller en intern sajt fungerar. Själva fångsten laddas aldrig upp någonstans; den enda nätverkstrafiken är din egen webbläsare som laddar sidan du bad om att fotografera.

Medan en fångst pågår kan du kort se en banner *"…started debugging this browser"* på den tillfälliga fliken. Det är DevTools Protocol i arbete; den försvinner av sig själv när bilden är klar.

## Läsa en sajt för Brand Studio

Källan **Website** i Brand Studio startar ett varumärke från en sajt du redan har. På Chromium är det tillägget som läser den; på skrivbordsappen gör en inbyggd hämtning samma jobb, och på en vanlig webbläsare utan tillägg erbjuds rutan inte alls.

Vad som händer när du trycker på den:

- En adress, en sida. Tillägget öppnar den i samma sorts bakgrundsflik, läser den renderade uppmärkningen, stilmallstexten och en handfull ikon- och logotypbilder, och stänger sedan fliken. Det följer inte länkar och det genomsöker inte sajten.
- Stilmallar och typsnitt som ligger på andra platser (ett CDN, en typsnittstjänst) hämtas också, eftersom sidans färger och typografi finns i dem. Cross-origin-förfrågningar går utan dina cookies; samma-origin-förfrågningar använder dem, precis som sidan själv skulle göra.
- Allt är begränsat - ett fast antal stilmallar, bilder och byte - så att en illvillig eller halvtrasig sida returnerar delvis material i stället för att hänga sig.
- Byten går direkt tillbaka till den Lolly-flik som bad om dem. Tolkningen till färger, typografi och logotyper sker på din enhet; inget laddas upp.

Ingenting läses förrän du trycker. Att klistra in en adress fyller bara i fältet.

## Efter installation

Ladda om Lolly-fliken. Uppmaningen "Get the extension" försvinner och **URL Screenshot** blir tillgängligt i galleriet och i Batch-läge.

## Behörigheter

Dess `manifest.json` deklarerar fyra behörigheter plus värdåtkomst:

- `debugger` - styr bakgrundsfliken via DevTools Protocol. Det är det som tar skärmdumpen.
- `tabs` - öppnar den tillfälliga bakgrundsfliken och stänger den igen efteråt.
- `scripting` - kör den enkla sidläsaren inuti sajten du angav, för Brand Studios Website-källa.
- `storage` - noterar id:t för en flik den öppnade, endast i sessionslagring, så att fliken ändå stängs om webbläsaren pausar tillägget mitt i läsningen. Rensas vid nästa start; inget om dig lagras.
- `host_permissions: ["<all_urls>"]` - värdåtkomst till *alla* sajter, eftersom du kan peka det mot vilken URL du vill. Chrome visar detta vid installation som en bred varning: "read and change all your data on all websites".

Trots den varningen läser det bara den enda sida du ber det fånga eller importera, och det läser eller överför inte din webbläsardata - inget laddas upp någonstans.

Manifestet anger även `minimum_chrome_version: 111`. Den aktuella versionen är 0.2.1.

## Felsökning

- **Ser fortfarande "Get the extension"?** Ladda om Lolly-fliken - identifieringen sker vid sidladdning.
- **Inget händer på denna sajt?** Tillägget aktiveras bara på Lollys egna ursprung. Kör du en anpassad byggd version på en annan domän? Lägg till den i `content_scripts.matches` i tilläggets `manifest.json`.
- **En fångst misslyckas?** Kontrollera att URL:en går att nå och börjar med `http://` eller `https://`. Vissa sidor blockerar aktivt automatiserad fångst.
