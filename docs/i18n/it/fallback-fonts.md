# Font di riserva

Quando i font di un design system non possono disegnare una lettera, Lolly la disegna con un font Noto aperto, così l'esportazione mantiene la lettera come contorno vettoriale anziché come immagine. I font di Lolly Demo, Outfit per i titoli e SUSE per il testo, non hanno lettere cirilliche, greche, arabe, ebraiche, devanagari, bengalesi, thailandesi, cinesi, giapponesi o coreane.

I font del design system vengono sempre per primi, nell'ordine in cui sono elencati. Outfit non ha lettere vietnamite, quindi un titolo vietnamita le prende da SUSE, il font successivo nell'elenco di Lolly Demo. Un font di riserva disegna solo i caratteri che nessuno di quei font può disegnare. Un font del brand mantiene ogni lettera, cifra e segno che possiede, compresi i caratteri cinesi, anche all'interno di una parola in un'altra scrittura.

<!--i:eti-package-->
## Cosa è incluso

Quindici font, tutti da Google Fonts a un commit fissato. Ogni file è mostrato con la sua dimensione di download.

| Scrittura | Font | Versione | Download |
|---|---|---|---|
| Arabo, incluse le lettere urdu e persiane | Noto Sans Arabic | 2.012 | 211 KB |
| Ebraico | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (hindi, marathi, nepalese) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengalese | Noto Sans Bengali | 3.011 | 139 KB |
| Thailandese | Noto Sans Thai | 2.002 | 62 KB |
| Cirillico | Noto Sans, lettere cirilliche | 2.015 | 115 KB, corsivo 132 KB |
| Greco | Noto Sans, lettere greche | 2.015 | 77 KB, corsivo 83 KB |
| Latino, incluse le lettere vietnamite e altre lettere accentate | Noto Sans, lettere latine | 2.015 | 316 KB, corsivo 350 KB |
| Cinese semplificato, i caratteri GB 2312 | Noto Sans SC | 2.004 | 2,0 MB |
| Cinese tradizionale, i caratteri Big5 | Noto Sans TC | 2.004 | 3,8 MB |
| Giapponese, i caratteri Shift_JIS | Noto Sans JP | 2.004 | 2,2 MB |
| Coreano, tutte le sillabe Hangul e i caratteri KS X 1001 | Noto Sans KR | 2.004 | 2,5 MB |

Ogni font mantiene tutti i pesi sul proprio asse del peso, quindi un titolo cinese, giapponese o coreano in grassetto resta in grassetto. I font Noto Sans hanno l'asse della larghezza fissato su normale, il che dimezza ogni file. I font cinesi, giapponesi e coreani non hanno un asse della larghezza. Noto Sans è suddiviso per scrittura, quindi una parola in cirillico scarica solo le lettere cirilliche. I contorni sono invariati rispetto all'originale.

::: details Dove si trovano i font e come vengono creati
I font si trovano in un'unica cartella condivisa, `community/fallback-fonts`, servita a ogni design system da `/catalog/packs/fallback-fonts/`, come i set di emoji. `scripts/import-fallback-fonts.ts` crea i file dai font originali fissati in `scripts/data/fallback-fonts.json`, verifica ogni file originale rispetto al suo SHA-256 registrato e scrive i testi delle licenze accanto ai font.
:::

<!--i:eti-globe-->
## Cinese, giapponese e coreano

Un font cinese, giapponese o coreano completo occupa da 9,6 MB a 17,8 MB. Ognuno viene ridotto al proprio set di caratteri nazionale, più punteggiatura, kana, forme a larghezza intera e simboli del testo corrente:

- Cinese semplificato: GB 2312, i 6.763 hanzi comuni e i suoi simboli, 7.522 caratteri in tutto.
- Cinese tradizionale: Big5, i suoi 13.053 hanzi e i suoi simboli, 13.629 caratteri in tutto. L'Hong Kong Supplementary Character Set non è incluso.
- Giapponese: Shift_JIS come viene letto da Windows e dal web, cioè JIS X 0208 con le aggiunte NEC e IBM necessarie per nomi come 髙 e 﨑, tutti i kana e i katakana a mezza larghezza, 7.432 caratteri in tutto.
- Coreano: tutte le 11.172 sillabe Hangul e KS X 1001, con i suoi 4.888 hanja, 17.082 caratteri in tutto.

Questi quattro font escludono le lettere latine, greche e cirilliche, disegnate dai font del design system e dai font elencati sopra. I set provengono dai file di indice dell'Encoding Standard a un commit fissato, quindi una ricostruzione produce gli stessi file.

Cinese, giapponese e coreano condividono la maggior parte dei caratteri ma ne disegnano molti in modo diverso. 直, per esempio, si scrive in un modo in cinese e in un altro in giapponese. Un segmento di testo prende tutti i caratteri condivisi da uno di questi font, mai da due. Lolly sceglie il font in quest'ordine:

1. La lingua del segmento, dal `lang` del suo elemento o di quello più vicino che lo contiene nel documento. Un'impostazione della lingua dello strumento, come Language del certificato, la definisce. La lingua dell'interfaccia di Lolly e quella del design system non contano, quindi un documento viene esportato allo stesso modo per tutti.
2. La scrittura del segmento: i kana indicano il giapponese e l'Hangul il coreano. Quando il segmento non contiene nessuno dei due, Lolly legge il documento, quindi un titolo di soli kanji in un documento giapponese viene disegnato in giapponese. Un documento con sia kana sia Hangul non determina nulla in questo passaggio.
3. Un carattere usato solo dal cinese tradizionale, come 體 o 說, nel segmento o altrimenti nel documento, indica il cinese tradizionale, a meno che lo stesso testo non contenga anche un carattere usato solo dal cinese semplificato.
4. Altrimenti, cinese semplificato.

Un carattere che manca al font scelto non viene mai preso da uno degli altri tre. Resta un'immagine. I kana o l'Hangul che mancano al font scelto, come parole coreane in una riga contrassegnata come giapponese, possono comunque provenire dal font giapponese o coreano, ma solo quando quel font non disegnerebbe alcun carattere condiviso della riga.

Sulla pagina, una tela che contiene due di queste lingue elenca entrambi i font e il browser disegna i caratteri condivisi con il primo. L'esportazione disegna ogni segmento con il proprio font.

<!--i:eti-download-->
## Quando viene scaricato un font

Non viene scaricato nulla finché un documento non contiene un carattere che nessun font del suo design system può disegnare. Un simbolo in una riga inglese, come ★ o ※, non scarica mai un font cinese, giapponese o coreano.

La prima volta che un documento richiede un font di riserva, Lolly scarica quel solo font e lo conserva sul tuo dispositivo. Un documento giapponese scarica solo il font giapponese, 2,2 MB, e uno in cinese tradizionale il font tradizionale da 3,8 MB. Da quel momento la scrittura viene disegnata offline e il font resta quando il catalogo viene ripulito. Il font viene conservato con i file del catalogo, mai tra i font che hai caricato, e non compare nell'elenco dei font del tuo brand.

La riga di comando, l'app da terminale e il server MCP leggono gli stessi file dal disco, quindi non richiedono download.

<!--i:eti-eye-->
## Sulla pagina e nell'esportazione

La pagina usa lo stesso font di riserva dell'esportazione, quindi una riga con queste lettere ha la stessa larghezza in entrambe. Solo su quella tela, Lolly aggiunge il font di riserva dopo i font del design system e prima di qualsiasi font di sistema. Uno strumento che imposta il proprio elenco di font, negli stili o sugli elementi, riceve il font di riserva nella stessa posizione. Una tela coperta dal design system mantiene invariato il suo elenco di font.

La pagina non modifica un elenco di font quando inizia con un font di sistema, come `system-ui` o Helvetica, perché l'esportazione disegna quel testo con i font del design system e la pagina no.

In un PDF le parole diventano contorni nel font di riserva con qualsiasi impostazione del testo, perché il testo live di un PDF non può contenere una scrittura assente dal font incorporato. In SVG, EMF, EPS, DXF e WMF diventano contorni ogni volta che il testo viene convertito in contorni. Se il testo resta live, lo disegnano i font del lettore. Quando un font di riserva ha disegnato parte di un'esportazione, il pannello di esportazione mostra una nota come questa:

> Il testo giapponese è disegnato con Noto Sans JP, perché i font di questo design system non hanno quelle lettere.

La riga di comando stampa la stessa frase come nota.

<!--i:eti-image-->
## Cosa resta un'immagine

Un carattere esterno ai quattro set nazionali, come 𠮷 o un carattere supplementare di Hong Kong, non ha un font di riserva. I caratteri rari come 𠮷, quelli aggiunti per Hong Kong dal suo set supplementare e le scritture senza un font di riserva, come tamil, etiope o siriaco, vengono tutti trattati allo stesso modo. Non lo ha neppure una scrittura come tamil, etiope o siriaco. In un PDF la riga che contiene questo testo entra come immagine a 300 dpi e il pannello di esportazione elenca le scritture. In un SVG il segmento resta testo live, disegnato dai font del lettore.

::: details Nelle esportazioni EPS, WMF ed EMF
Un EPS, un WMF o un EMF con **Outline fonts** attivo non ha testo live a cui ricorrere, quindi anche qui il segmento entra come immagine a 300 dpi. L'immagine applica il colore del testo solo dove ci sono le lettere, lasciando visibile lo sfondo. Il pannello di esportazione elenca le scritture. Un'immagine viene disegnata solo dritta, quindi un segmento ruotato o inclinato interrompe l'esportazione con un messaggio che riporta il segmento. In un WMF o EMF l'immagine è una coppia di operazioni bitmap, una maschera e una colorazione. Microsoft Office e LibreOffice le disegnano come previsto. Un'app che le ignora, come Inkscape, mostra le parole su un riquadro bianco.

Un EMF con **Outline fonts** disattivato mantiene questo segmento come testo live, disegnato dai font del lettore. L'eccezione è un segmento che il testo live EMF non può contenere, come testo con spaziatura tra le lettere. Lolly converte quel segmento in contorni, quindi anche lì un segmento che nessun font può disegnare entra come immagine.
:::

::: warning Un'esportazione DXF si ferma davanti a testo che nessun font può disegnare
Un DXF è destinato a macchine da taglio e software CAD, che richiedono contorni, quindi un segmento che nessun font può disegnare interrompe l'esportazione DXF. Il messaggio riporta il segmento e indica la sua scrittura. Aggiungi un font con quelle lettere o esporta in SVG o PDF.
:::

<!--i:eti-checklist-->
## Il controllo prima dell'esportazione

La scheda **Before you export** di Lolly Design e i controlli `render` di `lolly check` segnalano il testo che nessun font può disegnare. Considerano i font di riserva come fa un'esportazione, usando gli stessi elenchi di caratteri per font, quindi il testo disegnato da un font di riserva non viene segnalato. Una scrittura senza font di riserva, come il tamil, e un carattere cinese, giapponese o coreano esterno ai set nazionali vengono comunque segnalati, perché l'esportazione li disegna come immagine o testo live e un'esportazione DXF si ferma davanti a essi. Il controllo legge quegli elenchi dal catalogo e non scarica alcun font.

<!--i:eti-stamp-->
## Licenze e attribuzioni

Ogni font di riserva è distribuito con SIL Open Font License 1.1. Ogni voce del catalogo registra quella licenza con un hash del suo testo, così le regole sui diritti in [Diritti creativi e attribuzioni](/info/creative-rights.html) leggono la licenza come quella di qualsiasi altro font. I testi delle licenze si trovano accanto ai font. I file Noto Sans non dichiarano alcun Reserved Font Name. I font cinesi, giapponesi e coreani sono di Adobe e riservano il nome Source. I file ridotti mantengono i loro nomi Noto, che non usano quel nome.

La licenza afferma che le sue condizioni non si applicano ai documenti creati con i font. Un'esportazione contiene solo i contorni delle lettere che usa, come avviene con i font del design system. Lolly non aggiunge alcun programma di font, riga di attribuzione o nuova voce nella credenziale del contenuto per un font di riserva.
