# Font di riserva

I font di un design system spesso coprono solo alcune delle scritture del mondo. Lolly Demo usa Outfit per i titoli e SUSE per il testo, e nessuno dei due ha lettere cirilliche, greche, arabe, ebraiche, devanagari, bengalesi, thailandesi, cinesi, giapponesi o coreane. Quando un documento contiene lettere che i font del suo design system non sanno disegnare, Lolly le disegna con un font Noto aperto, così l'esportazione le conserva come contorni vettoriali invece di trasformare le parole in un'immagine.

I font del design system vengono sempre per primi, nell'ordine in cui il design system li elenca. Outfit non ha le lettere vietnamite, quindi un titolo in vietnamita le prende da SUSE, il font successivo nell'elenco di Lolly Demo. Un font di riserva disegna solo i caratteri che nessuno di quei font sa disegnare, quindi un font del brand conserva ogni lettera, cifra e segno che ha, anche dentro una parola in un'altra scrittura. Un font del brand che ha un carattere cinese conserva anche quel carattere.

## Cosa è incluso

Quindici font, tutti da Google Fonts a un commit fissato e tutti con licenza SIL Open Font License 1.1. Ogni file è indicato con la sua dimensione di download.

| Scrittura | Font | Versione | Download |
|---|---|---|---|
| Arabo, comprese le lettere urdu e persiane | Noto Sans Arabic | 2.012 | 211 KB |
| Ebraico | Noto Sans Hebrew | 3.001 | 37 KB |
| Devanagari (hindi, marathi, nepalese) | Noto Sans Devanagari | 2.007 | 151 KB |
| Bengalese | Noto Sans Bengali | 3.011 | 139 KB |
| Thailandese | Noto Sans Thai | 2.002 | 62 KB |
| Cirillico | Noto Sans, lettere cirilliche | 2.015 | 115 KB, corsivo 132 KB |
| Greco | Noto Sans, lettere greche | 2.015 | 77 KB, corsivo 83 KB |
| Latino, compreso il vietnamita e altre lettere accentate | Noto Sans, lettere latine | 2.015 | 316 KB, corsivo 350 KB |
| Cinese semplificato, i caratteri GB 2312 | Noto Sans SC | 2.004 | 2,0 MB |
| Cinese tradizionale, i caratteri Big5 | Noto Sans TC | 2.004 | 3,8 MB |
| Giapponese, i caratteri Shift_JIS | Noto Sans JP | 2.004 | 2,2 MB |
| Coreano, ogni sillaba hangul e i caratteri KS X 1001 | Noto Sans KR | 2.004 | 2,5 MB |

L'asse del peso di ogni font è mantenuto intero, quindi ogni peso richiesto da un design si disegna ancora e un titolo cinese, giapponese o coreano in grassetto resta in grassetto. L'asse della larghezza dei font Noto Sans è fissato su normale, il che dimezza ogni file; i font cinese, giapponese e coreano non hanno un asse della larghezza. Noto Sans è diviso per scrittura, quindi una parola cirillica scarica solo le lettere cirilliche. I contorni sono quelli originali, invariati.

I font stanno in un'unica cartella condivisa, `community/fallback-fonts`, servita a ogni design system da `/catalog/packs/fallback-fonts/`, nello stesso modo in cui sono condivisi i set di emoji. `scripts/import-fallback-fonts.ts` crea i file a partire dai font originali fissati in `scripts/data/fallback-fonts.json`, controlla ogni file originale con il suo SHA-256 registrato e scrive i testi delle licenze accanto ai font.

## Cinese, giapponese e coreano

Un font cinese, giapponese o coreano completo pesa da 9,6 MB a 17,8 MB, quindi ognuno di questi font è ridotto al set di caratteri nazionale che i suoi lettori usano ogni giorno, più la punteggiatura, i kana, le forme a larghezza piena e i simboli del testo corrente:

- Cinese semplificato: GB 2312, i 6.763 hanzi comuni e i suoi simboli, 7.522 caratteri in tutto.
- Cinese tradizionale: Big5, i suoi 13.053 hanzi e i suoi simboli, 13.629 caratteri in tutto. L'Hong Kong Supplementary Character Set non è incluso.
- Giapponese: Shift_JIS come lo leggono Windows e il web, cioè JIS X 0208 con le aggiunte NEC e IBM che servono a nomi come 髙 e 﨑, ogni kana e il katakana a mezza larghezza, 7.432 caratteri in tutto.
- Coreano: tutte le 11.172 sillabe hangul e KS X 1001, con i suoi 4.888 hanja, 17.082 caratteri in tutto.

Le lettere latine, greche e cirilliche sono escluse da questi quattro font, perché le disegnano i font del design system e quelli elencati sopra. I set sono letti dai file indice dell'Encoding Standard a un commit fissato, quindi una ricostruzione dà gli stessi file.

Cinese, giapponese e coreano condividono la maggior parte dei caratteri, ma ciascuno ne disegna molti in modo diverso. Lo stesso carattere 直 si scrive in un modo in cinese e in un altro in giapponese. Quindi una porzione di testo prende tutti i suoi caratteri condivisi da uno solo di questi font, mai da due, e Lolly sceglie quel font in quest'ordine:

1. La lingua della porzione, dal `lang` del suo elemento o di quello più vicino che lo racchiude nel documento. L'impostazione della lingua di uno strumento, come la Language del certificato, la determina. La lingua dell'interfaccia di Lolly e quella del design system non contano, quindi un documento si esporta allo stesso modo per tutti.
2. La scrittura della porzione: i kana indicano il giapponese e l'hangul il coreano. Quando la porzione non ha né l'uno né l'altro, si legge l'intero documento, quindi un titolo di soli kanji in un documento giapponese viene disegnato in giapponese. Un documento che contiene sia kana sia hangul qui non decide nulla.
3. Un carattere usato solo dal cinese tradizionale, come 體 o 說, nella porzione o altrimenti nel documento, indica il cinese tradizionale, a meno che lo stesso testo non contenga anche un carattere usato solo dal cinese semplificato.
4. Altrimenti, cinese semplificato.

Un carattere che il font scelto non ha non viene mai preso da uno degli altri tre. Resta un'immagine, come descritto più sotto. I kana o l'hangul che il font scelto non ha, come parole coreane in una riga indicata come giapponese, possono comunque venire dal font giapponese o coreano, ma solo quando quel font non disegnerebbe alcun carattere condiviso della riga.

Sulla pagina, una tela che contiene due di queste lingue elenca entrambi i font, e il browser disegna i caratteri condivisi con il primo. L'esportazione disegna ogni porzione con il proprio.

## Quando un font viene scaricato

Non si scarica nulla finché un documento non contiene un carattere che nessun font del suo design system sa disegnare. Un documento in inglese, o in qualsiasi lingua che il suo design system copre, non scarica mai un font di riserva. Un simbolo in una riga inglese, come ★ o ※, non scarica mai un font cinese, giapponese o coreano.

La prima volta che un documento ne ha bisogno, Lolly scarica quell'unico font, per quella singola scrittura, e lo conserva sul tuo dispositivo. Un documento giapponese scarica solo il font giapponese, 2,2 MB, e uno in cinese tradizionale il font tradizionale da 3,8 MB. Da quel momento la scrittura si disegna offline, e il font resta anche quando il catalogo viene ripulito. Il font è conservato insieme ai file del catalogo, mai tra i font che hai caricato, quindi non compare nell'elenco dei font del tuo brand.

La riga di comando, l'app da terminale e il server MCP leggono gli stessi file dal disco, quindi non hanno bisogno di scaricare nulla.

## Sulla pagina e nell'esportazione

La pagina usa lo stesso font di riserva dell'esportazione. Senza questo, un browser disegna tali lettere con un font di sistema mentre l'esportazione usa Noto, e una riga che le contiene cambia larghezza tra le due. Lolly aggiunge il font di riserva in fondo all'elenco dei font del design system su quella tela soltanto, dopo i font propri del design system e prima di qualsiasi font di sistema. Uno strumento che imposta il proprio elenco di font, nei suoi stili o sui suoi elementi, riceve il font di riserva nello stesso punto: dopo i font che l'elenco indica e prima di qualsiasi font di sistema. Una tela che il design system copre mantiene il suo elenco di font esattamente com'era.

La pagina lascia invariato un elenco di font quando inizia con un font di sistema, come `system-ui` o Helvetica, perché l'esportazione disegna quel testo con i font del design system e la pagina no.

In un PDF le parole diventano contorni disegnati con il font di riserva, qualunque impostazione del testo tu scelga, perché il testo PDF vivo non può contenere una scrittura che il font incorporato non ha. In SVG, EMF, EPS, DXF e WMF diventano contorni ogni volta che il testo viene convertito in contorni; con il testo mantenuto vivo, le disegnano i font di chi legge, come prima. Quando un font di riserva ha disegnato una parte di un'esportazione, il pannello di esportazione mostra una nota come questa:

> Il testo giapponese è disegnato con Noto Sans JP, perché i font di questo design system non hanno quelle lettere.

La riga di comando stampa la stessa frase come nota.

## Cosa resta un'immagine

Un carattere fuori dai quattro set nazionali non ha un font di riserva. Caratteri rari come 𠮷, i caratteri aggiunti per Hong Kong dal suo set supplementare e le scritture senza font di riserva, come tamil, etiope o siriaco, sono tutti trattati allo stesso modo. In un PDF la riga che ne contiene uno entra come immagine a 300 dpi, e il pannello di esportazione elenca le scritture. In un SVG la porzione resta testo vivo, che disegnano i font di chi legge.

## Il controllo prima di esportare

La scheda **Before you export** di Lolly Design e i controlli `render` di `lolly check` segnalano il testo che nessun font sa disegnare. Contano i font di riserva come fa un'esportazione, dalle stesse liste dei caratteri che ogni font possiede, quindi il testo che un font di riserva disegna non viene segnalato. Una scrittura senza font di riserva, come il tamil, e un carattere cinese, giapponese o coreano fuori dai set nazionali vengono comunque segnalati, perché l'esportazione li disegna come immagine o come testo vivo. Il controllo legge quelle liste dal catalogo e non scarica alcun font.

## Licenze e crediti

Ogni font di riserva ha licenza SIL Open Font License 1.1, e ogni voce del catalogo registra quella licenza con un hash del testo della licenza, così le regole sui diritti in [Creative rights and credits](/info/creative-rights.html) leggono la licenza come quella di qualsiasi altro font. I testi delle licenze stanno accanto ai font. I file Noto Sans non dichiarano alcun Reserved Font Name. I font cinese, giapponese e coreano sono di Adobe e riservano il nome Source; i file ridotti mantengono i loro nomi Noto, che non usano quel nome.

La licenza dice che i suoi termini non si applicano ai documenti creati con i font. Un'esportazione contiene solo i contorni disegnati delle lettere che usa, come per i font del design system stesso, e Lolly non aggiunge alcun programma di font, alcuna riga di credito e alcuna nuova voce nelle Content Credentials per un font di riserva.
