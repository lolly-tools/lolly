# Politica de confidențialitate

*Ultima actualizare: 23 octombrie 2026*

**Crearea lucrurilor în Lolly se întâmplă pe dispozitivul tău.** Deschiderea unui instrument, scrisul, previzualizarea, exportul și verificarea unui fișier se desfășoară toate în aplicația de pe telefon, computer sau browser. Nu ai nevoie de cont, iar aplicația nu setează cookie-uri pentru nimic din toate acestea.

**Ce creezi pleacă de pe dispozitiv doar când ceri tu.** Adăugarea unui Google Font, trimiterea unui fișier în Drive sau Dropbox, activarea Sync, redarea radioului sau descărcarea unui model AI local fac fiecare o cerere pornită de tine. Aplicația își preia instrumentele și actualizările și de la propria adresă, iar acele cereri nu poartă nimic din ce ai creat. [Fiecare cerere de rețea pe care o poate face aplicația](#every-network-request-the-app-can-make) le enumeră, gazdă cu gazdă.

**Câteva servicii Lolly rulează pe un server.** Linkurile de randare, preluarea de imagini, endpoint-ul pentru agenți AI și serviciul de identitate verificată primesc doar ce le trimiți și nu păstrează datele mai mult decât spune această pagină.

**Instanța Lolly Work a organizației tale este diferită.** Ea stochează munca comună pe care o pui acolo, iar politica operatorului ei se aplică acelor date, nu aceasta.

::: figure privacy-where-data-goes
Încotro merg datele tale: rămân pe dispozitiv dacă nu pornești tu o cerere, iar fiecare fel de cerere are propria destinație.
:::

## Ce acoperă această politică

Lolly este un software open-source pe care îl poate rula oricine: un motor, shell-uri de aplicație pentru web, desktop, mobil și terminal, plus o extensie de browser. Această politică are două părți:

- <!--i:code--> **Software-ul în sine**: ce face și ce nu face cu datele tale, oriunde rulează. Aceasta este o proprietate a codului, deci este valabilă pentru orice instalare Lolly, a noastră sau a altcuiva.
- <!--i:server--> **lolly.tools**, instalarea de referință operată de SUSE: alegerile făcute la rularea componentelor sale opționale de server, cum ar fi ce se înregistrează în jurnal, pentru cât timp și de către cine.

Pe o instanță Lolly găzduită propriu sau enterprise, comportamentul software-ului descris mai jos se aplică în continuare, dar *operatorul* acelei instanțe, nu SUSE, răspunde pentru tot ce se află pe serverele lui: endpoint-ul de randare, serverul MCP, serviciul de certificate și instanța Lolly Work. Cere-i propria politică. [Adopție și guvernanță](/info/adoption-governance.html) descrie ce implică operarea Lolly.

## Ce rămâne pe dispozitivul tău

Aplicațiile Lolly pentru web, desktop și mobil rulează întregul motor de randare pe dispozitiv. După ce instrumentele, resursele și codificatoarele pe care le folosești sunt pe dispozitiv, randarea și descărcarea nu au nevoie de server.

**Folosirea aplicației de sine stătătoare nu setează cookie-uri.** Autentificarea în organizație și înrolarea opțională pentru identitate verificată au propriile cookie-uri, descrise în secțiunile lor. Aplicația păstrează aceste înregistrări pe dispozitiv:

- <!--i:sliders--> **Preferințe de interfață**: tema, limba, setările de sunet, dimensiunile barei laterale și ale zoomului, alegerile de sortare și vizualizare și ce sfaturi ai văzut, în `localStorage`, ca să fie gata înainte ca aplicația să termine pornirea.
- <!--i:download--> **Un cache offline al catalogului de instrumente și al previzualizărilor de resurse**, ca galeria să funcționeze fără conexiune.
- <!--i:hash--> **Contoare locale de utilizare** pentru statisticile cardului tău de profil, cum ar fi câte exporturi și ce instrumente: o înregistrare mică și limitată în `localStorage`, niciodată citită de noi și niciodată trimisă nicăieri.
- <!--i:folder--> **Munca ta**: documente, sesiuni salvate și istoricul lor, imagini și fonturi încărcate, rezultate de fișiere și versiuni anterioare, plus Coșul, care păstrează elementele șterse 30 de zile. Acestea trăiesc în IndexedDB pe dispozitiv și rămân acolo dacă nu alegi Sync sau partajarea.
- <!--i:globe--> **Căutările de orașe ale Meeting Planner**, în `localStorage`, ca fiecare oraș să fie căutat o singură dată.
- <!--i:cpu--> **Modele descărcate și instrumente fixate**: modelele AI locale pe care ai acceptat să le descarci și instrumentele fixate pentru folosire offline.

**Settings → Storage** arată cât spațiu folosește Lolly pe dispozitiv, cu munca ta, Coșul, modelele descărcate, copiile offline și cache-urile enumerate pe rând. **Clear all my data** de acolo șterge copia locală și oprește mai întâi Sync; ștergerea spațiului de stocare al site-ului din browser face același lucru. Stocarea strict necesară serviciului cerut de tine nu necesită consimțământ conform Directivei ePrivacy (Art. 5(3)), ci doar transparență, adică exact ce oferă acest document și notificarea din aplicație.

![Secțiunea de stocare din Settings pe un ecran de telefon: fiecare categorie de date de pe dispozitiv este numită, cu butonul Clear all my data lângă listă](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-selbar%2C.profile-row-value%2C.profile-group-value%2C%23store-hero-num%2C%23store-headroom%7Bdisplay%3Anone%7D&format=svg&waitSelector=%5Bdata-store-group%3Dmove%5D&drive=click%3A%5Bdata-store-group%3Dwork%5D%3Esummary%3Bclick%3A%5Bdata-store-group%3Dcaches%5D%3Esummary&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

**Export my data** produce un fișier `lolly-backup` pe care îl păstrezi și îl controlezi tu. Nu atinge serverele noastre decât dacă îl trimiți chiar tu undeva. Vezi [Transferul de date](/info/data-transfer.html).

### Utilitare care rulează pe dispozitivul tău

Unele instrumente, precum **Strip Hidden Data**, **Compress** și altele cu insigna **Runs on your device**, lucrează pe un fișier pe care îl furnizezi. Fișierul este citit în memorie, transformat pe dispozitiv și oferit înapoi ca descărcare. Nu este încărcat niciodată, deoarece pe traseu nu există server. Aceste utilitare funcționează offline, iar rezultatul lor nu poartă filigran și nici metadate de-ale noastre.

**Rondocode** este singura excepție, pentru că produce audio nou din cântecul tău, în loc să transforme un fișier al tău. Fiecare fișier audio pe care îl scrie poartă Content Credentials care înregistrează cântecul și declară orice cântat generat de AI. Panoul Export spune asta înainte să exporți, iar [Cântecele Rondocode](/info/rondocode.html#files-from-the-rondocode-utility) listează exact ce se înregistrează.

![Insigna pe care o poartă aceste instrumente: Runs on your device - nimic nu este încărcat](/t/url-shot?url=%2F%23%2Ftool%2Ftext-helper&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%5Bdata-privacy%5D&dark=1&filename=pv-ondevice-badge)

**Prepare for sharing** și **Compare** lucrează în memorie pe dispozitiv și nu trimit nimic la vreun server, iar Prepare nu adaugă nimic în istoric, linkuri, copii de siguranță sau Sync până nu salvezi un rezultat.

::: details Cum tratează Prepare for sharing și Compare fișierele tale
**Prepare for sharing** ține intrările de lucru, constatările private și hărțile de înlocuire în memorie, fără să le adauge în istoric, linkuri, copii de siguranță sau Sync. Inspecția și înlocuirea nu trimit conținutul fișierelor la vreun server și nu verifică online nicio credențială. Tu alegi dacă copiezi, descarci, trimiți sau salvezi un rezultat în biblioteca ta; un rezultat salvat urmează apoi setările de backup și Sync ale bibliotecii. Fișierele de rețetă omit conținutul anterior și mapările literale, iar rapoartele de sinteză conțin numărători, ID-uri de domeniu și hash-uri de fișier. CLI-ul salvează un fișier de revizuire privat cu valorile originale doar când este cerut cu `--review-file`. Părăsirea unei vederi de pregătire eliberează starea ei de lucru, ceea ce nu este o promisiune de ștergere criminalistică din memoria browserului sau a sistemului de operare.

Copiile pregătite și operațiunile terminate pe fișiere folosesc în comun controalele Compare. Valorile eliminate pornesc restrânse, iar rapoartele de comparare omit numele sursei, căile și valorile, dacă nu alegi să le incluzi. Istoricul fișierelor salvează copia, deci compararea după o reîncărcare înseamnă să selectezi din nou originalul, potrivit după SHA-256-ul înregistrat. Selectarea lui nu salvează și nu încarcă fișierul.
:::

Strip Hidden Data și Prepare for sharing inspectează pe dispozitiv și fișiere DOCX, PPTX și XLSX. La fișierele DOCX acceptate se pot elimina anumite proprietăți într-o copie nouă; restul conținutului Office este doar pentru inspecție, iar previzualizările private rămân în spatele unui control de dezvăluire.

::: details Ce citește și ce elimină inspecția Office
| Format Office | Conținut de pachet inspectat | Eliminare acceptată |
|---|---|---|
| DOCX | Proprietăți de bază, de aplicație și personalizate; comentarii și autori; marcaje și previzualizări de modificări urmărite; secvențe de text ascunse; relații externe; obiecte încorporate | Autorul, ultima persoană care a salvat, datele creării/modificării/ultimei tipăriri, titlul, subiectul, descrierea, cuvintele-cheie, proprietățile personalizate, Company, Manager, Template, baza hiperlegăturilor, numele și versiunea aplicației și statisticile (timp total de editare și numărul de pagini, cuvinte, caractere, rânduri și paragrafe) selectate |
| PPTX | Proprietăți; comentarii și înregistrări de autor; notele vorbitorului; marcaje de diapozitive ascunse; relații externe; obiecte încorporate și registre imbricate acceptate | Niciuna |
| XLSX | Proprietăți; comentarii și note; marcaje de foi, rânduri și coloane ascunse; nume definite; relații și conexiuni externe; suprafețe de link extern și de cache pivot; obiecte încorporate | Niciuna |

**Limite.** Recensământul nu inspectează complet textul vizibil, formulele, dependențele, aspectul randat sau părțile binare arbitrare. Acceptă până la 300 de părți de pachet, 64 MiB de expandare totală declarată, 2 MiB per parte XML și două niveluri de pachete încorporate imbricate; Prepare împarte bugetele de părți și de expandare între întreaga sarcină. Conținutul trunchiat, malformat, criptat și neacceptat este raportat și păstrat. Conținutul cu macro-uri este identificat și niciodată rulat, formatele Office binare vechi și XLSB nu sunt inspectate, iar referințele externe nu sunt niciodată preluate.

**Ce păstrează curățarea DOCX.** Curățarea acceptă formatul de pachet DOCX tranzițional, cu părți canonice de proprietăți de bază, personalizate și extinse. Din proprietățile extinse se pot elimina Company, Manager, Template, HyperlinkBase, Application, AppVersion și statisticile TotalTime, Pages, Words, Characters, CharactersWithSpaces, Lines și Paragraphs. DocSecurity, titlurile de antet și de părți, indicatorii de linkuri și alte proprietăți de aplicație sunt păstrate. Eliminarea Template lasă orice link către un șablon atașat în setările documentului, unde recensământul îl raportează ca relație externă.

Unele aplicații de citire aleg cum desenează diagramele și desenele pe baza numelui și versiunii aplicației; LibreOffice, de exemplu, afișează diferit o diagramă dintr-un fișier Word 2007 fără ele. Ambele sunt păstrate când fișierul conține diagrame, imagini, forme sau obiecte încorporate, iar inspecția le listează ca păstrate. O proprietate pe care o arată un câmp Word (TEMPLATE, EDITTIME, NUMPAGES, NUMWORDS sau NUMCHARS) este păstrată, iar câmpurile de link și linkurile externe relative păstrează HyperlinkBase, pentru că țintele lor se rezolvă față de acea adresă de bază.

**Ce rămâne doar pentru inspecție.** Datele extinse de semnătură digitală împiedică curățarea. Pachetele Office semnate, cu macro-uri, criptate, malformate, redenumite sau imbricate rămân doar pentru inspecție. La fel fișierele cu alte câmpuri Word dependente de proprietăți, precum DOCPROPERTY sau AUTHOR, sau cu controale de conținut legate de XML, pentru că eliminarea unei proprietăți ar putea schimba documentul când Word actualizează acele legături, iar textul câmpului din cache nu poate arăta că următoarea randare va arăta la fel. Părțile XML cu extensii neobișnuite de nume de fișier, țintele de relații Word XML care nu pot fi inspectate în siguranță, părțile de antet sau subsol declarate greșit și părțile SVG declarate ca XML cu extensia `.svg` rămân și ele doar pentru inspecție în această primă versiune de curățare.

**Cum își verifică curățarea lucrul.** Părțile de proprietăți, declarațiile lor, membrii de pachet fără legătură, comentariile XML și comentariile ZIP sunt păstrate. Curățarea aplică limitele recensământului și verifică integritatea fiecărui membru înainte de scriere, apoi inspectează din nou proprietățile rezultate. Compare arată diferențele de proprietăți acceptate cu valorile restrânse; nu compară textul vizibil sau aspectul randat. Valorile folosesc previzualizări de până la 2048 de caractere, deci diferențele de dincolo de o previzualizare pot să nu apară, iar o revizuire parțială nu poate stabili că două fișiere sunt egale. Comanda `prepare --strip-hidden-data` a CLI-ului elimină proprietățile DOCX acceptate, iar un plic de revizuire privat poate selecta proprietăți individuale. O gardă de curățare eșuată păstrează fișierul și raportează o operațiune eșuată.
:::

## Fiecare cerere de rețea pe care o poate face aplicația

Cele mai multe cereri aduc instrumente, fonturi sau modele pe dispozitivul tău. Acțiunile Send transmit fișierul ales de tine, Sync transmite o copie de siguranță în spațiul de stocare ales de tine, iar serviciile organizației transmit conținutul sau detaliile necesare pentru munca comună. Fiecare grup de mai jos listează ce părăsește dispozitivul, când și ce se întâmplă dacă un operator blochează cererea. Furnizorii de identitate și de resurse configurați de un operator pot adăuga destinații la acea instalare. [Fiecare gazdă fixă, într-un singur tabel](#every-fixed-host-in-one-table) listează gazdele pe care le poate contacta aplicația web.

::: details Lucruri aduse pe dispozitivul tău
- <!--i:download--> **Catalogul de instrumente.** Nimic personal: o cerere pentru indexul public de instrumente și resurse Lolly, către propria adresă a aplicației, la pornire, apoi păstrat în cache offline. Dacă este blocat, aplicația rulează pe instrumentele din cache și nu mai descoperă altele noi.
- <!--i:sparkle--> **Seturi de emoji.** Setul ales se descarcă de la propria adresă a aplicației prima dată când folosești acel set. Nu se trimite nimic personal. Animațiile Lottie sunt citite pe dispozitiv și nu contactează pe nimeni.
- <!--i:document--> **Google Fonts.** Numele familiei alese și adresa ta IP merg la serverele de fonturi Google (`fonts.googleapis.com` pentru foaia de stil, `fonts.gstatic.com` pentru fișierul de font). Se întâmplă doar când adaugi un Google Font în Design System Setup și doar după ce ești de acord într-un dialog care spune exact asta. Fiecare familie este preluată o dată, apoi păstrată pe dispozitiv și folosită offline. Dacă este blocat, selectorul eșuează în siguranță; încarcă în schimb un fișier de font.
- <!--i:cpu--> **Modele AI locale.** Nimic personal: o descărcare de fișier de model, apoi păstrat pe dispozitiv. Variantele web folosesc implicit propria adresă a aplicației; o variantă poate indica o altă gazdă de modele, precum gazda de versiuni a Lolly `lolli.li` pentru aplicațiile împachetate. Gazda primește cererea și adresa ta IP, fără cont și fără intrările modelului. Se întâmplă doar când folosești o funcție care necesită un model (scanarea profundă din Verify, mărirea imaginilor, vorbirea și altele asemenea) sau alegi să descarci modele pentru folosire offline. Dacă este blocat, acea funcție așteaptă, iar restul funcționează.
- <!--i:sliders--> **Profiluri ICC de tipar.** Nimic personal: o cerere pentru un profil standard de condiții de tipărire către registrul public al ICC (`registry.color.org`, `www.color.org`), doar când faci clic pe o presetare ICC în managerul de profiluri de tipar, o dată pe profil. Dacă este blocat, presetările eșuează; furnizează-ți propriul profil `.icc`.
- <!--i:globe--> **Radio pe internet.** Nimic personal: o cerere de listă de redare și un flux audio de la stație (`api.somafm.com` și serverul de flux către care trimite, `*.somafm.com`), doar cât timp redai radioul opțional din playerul de sunet. Dacă este blocat, radioul eșuează, iar toate celelalte funcții de sunet merg.
:::

::: details Un instrument care are nevoie de date live
- <!--i:globe--> **Căutarea orașelor din Meeting Planner.** Astăzi este singurul instrument care preia date live. Cere de la `geocoding-api.open-meteo.com` să transforme fiecare nume de oraș (orașul gazdă și orașul fiecărui membru al echipei) în coordonate și fus orar, fără cont, fără cheie și fără alt identificator în afară de cererea însăși. Câmpul Host city explică asta, iar fiecare răspuns este salvat pe dispozitiv, deci un oraș este căutat o singură dată. Rulează doar cât timp instrumentul este deschis. Dacă este blocat, căutarea eșuează și nimic altceva nu este afectat.
:::

::: details Fișiere pe care le trimiți
Fiecare dintre acestea trimite doar fișierul ales de tine, când apeși butonul Send, după o autentificare pe care o finalizezi în fereastra proprie a serviciului. Parola de aplicație Bluesky, adresa webhook Discord, parola de aplicație Nextcloud și cheile S3 sunt stocate doar pe acest dispozitiv, niciodată într-o copie de siguranță, iar **Disconnect** le șterge.

- <!--i:upload--> **Google Drive.** Fișierul, în orice format, merge la API-ul Drive al Google (`www.googleapis.com`). Accesul Lolly este limitat la fișierele create de el (domeniul `drive.file`), deci nu poate citi niciodată restul Drive-ului tău. În aplicația web, tokenul de autentificare este ținut în memorie pe durata sesiunii și nu este stocat niciodată; în celelalte aplicații, un token de reîmprospătare este stocat doar pe acest dispozitiv dacă bifezi **Stay connected**. Butonul există doar în variantele în care operatorul a configurat un client id Google. Dacă este blocat, butonul nu apare niciodată; descarcă fișierul și încarcă-l singur.
- <!--i:upload--> **Dropbox.** Fișierul merge la API-ul Dropbox (`api.dropboxapi.com` pentru autentificare și metadate, `content.dropboxapi.com` pentru fișier). Accesul este doar la dosarul aplicației, deci Lolly vede `Apps/` și propriul dosar de acolo și nimic altceva. Linkul **Open** pe care îl afișează este un link privat de scurtă durată și nu se creează nicio partajare publică. Un token de reîmprospătare este stocat doar dacă bifezi **Stay connected**. Butonul există doar cu un client id Dropbox configurat de operator.
- <!--i:upload--> **OneDrive.** Fișierul merge la serviciile de identitate și Graph ale Microsoft (`login.microsoftonline.com` pentru autentificare, `graph.microsoft.com` pentru încărcare); un fișier mare se încarcă în bucăți la `api.onedrive.com` sau la origini de stocare configurate de operator. Accesul este limitat la dosarul propriu al Lolly din `Apps/`, plus numele tău afișat pentru eticheta contului. Un token de reîmprospătare este stocat doar dacă bifezi **Stay connected**. Butonul există doar cu un client id Microsoft configurat de operator.
- <!--i:upload--> **LinkedIn**, **doar în aplicațiile desktop**. Fișierul, cu numele lui ca text al postării, merge la LinkedIn (`www.linkedin.com` pentru autentificare în propriul browser, `api.linkedin.com` pentru încărcare și postare) ca postare publică pe propriul flux. Lolly poate posta în numele tău și îți poate citi numele pentru eticheta contului, nimic altceva. Autentificarea este păstrată doar dacă bifezi **Stay connected**, iar tokenurile LinkedIn durează 60 de zile și nu pot fi reînnoite discret, deci expiră de la sine. Acele gazde nu sunt în politica de conexiuni a aplicației web. Butonul există doar în variantele cu o aplicație LinkedIn configurată.
- <!--i:upload--> **Penpot.** Tokenul tău personal de acces Penpot, pe care îl lipești în aplicație, și arhiva `.penpot` a designului merg la API-ul Penpot (`design.penpot.app`) printr-un mic intermediar transparent la propria adresă a aplicației (`/api/penpot`), pentru că API-ul Penpot nu răspunde direct unui browser. Intermediarul transmite și uită; aplicațiile desktop vorbesc direct cu Penpot. Se întâmplă doar când apeși **Send to Penpot** în instrumentul Design și confirmi un proiect. Dacă este blocat, trimiterea eșuează în siguranță; exportă fișierul `.penpot` și importă-l singur.
- <!--i:upload--> **Bluesky.** Imaginea, numele ei ca text al postării și text alternativ, plus handle-ul și parola ta de aplicație (create în Bluesky → Settings → App passwords, niciodată parola contului) merg la serverul Bluesky pe care îl indici, `bsky.social` dacă nu alegi altul. Conectezi mai întâi contul în **Settings → Connected services**.
- <!--i:upload--> **Discord.** Fișierul merge ca atașament la adresa webhook a canalului pe care ai lipit-o, pe discord.com. Oricine deține o adresă webhook poate posta pe acel canal, de aceea rămâne pe dispozitiv.
- <!--i:upload--> **Mastodon.** Fișierul, cu numele lui ca text al postării, merge la serverul Mastodon sau compatibil pe care îl indici, după o autentificare în fereastra proprie a acelui server. Conectarea înregistrează pe acel server o mică aplicație pentru acest dispozitiv, iar autentificarea este păstrată doar dacă bifezi **Stay connected**.
- <!--i:upload--> **Nextcloud sau WebDAV.** Fișierul merge la propriul tău server într-o singură încărcare autentificată, cu adresa serverului, numele de utilizator și parola de aplicație pe care le-ai introdus (Nextcloud → Settings → Security → Devices & sessions; niciodată parola contului).
- <!--i:upload--> **Stocare compatibilă S3.** Fișierul merge în propriul tău bucket (AWS S3, MinIO, R2, B2, Garage sau orice endpoint SigV4), semnat pe dispozitiv cu perechea de chei introdusă de tine.

**Gazdele alese de tine necesită aprobarea operatorului.** Gazdele Bluesky, Discord, Mastodon, Nextcloud și S3 nu sunt în lista fixă a Lolly, pentru că le alegi tu. Aplicația nu trimite nimic către una până când operatorul nu a aprobat exact acea gazdă HTTPS: pe web, în Content Security Policy a instalării; în aplicațiile desktop, la construirea aplicației. Același lucru se aplică gazdelor de stocare personalizată și de încărcare SharePoint. Pe web, serverul trebuie să permită și apeluri din browser de la aplicație (CORS), iar o redirecționare eșuează în siguranță, deci folosește o adresă care nu redirecționează. Aplicațiile desktop verifică fiecare redirecționare față de lista aprobată.

Această listă limitează gazdele pe care le poate atinge aplicația. Nu deosebește conturile sau tenanții la Google ori Microsoft, iar permisiunile proprii ale furnizorului decid ce conturi și acțiuni sunt permise. Nu acoperă nici ferestrele de autentificare, alte tipuri de resurse sau funcțiile native, care au propriile reguli. O schimbare cere o nouă versiune desktop sau noi anteturi de răspuns web; salvează-ți munca înainte de a redeschide aplicația ca să o preia. [Originile conectorilor](/info/connector-origins.html) descrie configurarea.
:::

::: details Sync între dispozitivele tale
- <!--i:folder--> **Ce pleacă.** O copie a ce ai creat pe acest dispozitiv (sesiuni și proiecte salvate, sistemele tale de design cu fonturile și logourile lor, imagini încărcate, profilul și preferințele) ca un singur fișier, către singurul spațiu de stocare ales de tine: dosarul aplicației Lolly din Dropbox (`api.dropboxapi.com`, `content.dropboxapi.com`), fișierele create de Lolly în Google Drive (`www.googleapis.com`), dosarul aplicației Lolly din OneDrive (`graph.microsoft.com`, cu fișierele mai mari încărcate la `api.onedrive.com` sau la origini de stocare configurate de operator, iar descărcările de la origini de stocare exacte configurate de operator) sau propriul tău Nextcloud, server WebDAV ori bucket S3. Același spațiu de stocare păstrează până la șapte copii zilnice și o copie de dinainte de ultima aplicare.
- <!--i:shieldcheck--> **Nimic nu merge la Lolly.** Pe traseu nu se află niciun server Lolly, releu sau server Lolly Work, iar aplicațiile nu au nevoie de vreun site Lolly pentru asta, nici măcar pentru autentificare. Copia este criptată mai întâi pe dispozitiv doar dacă setezi o frază de acces. Autentificările, cheile, parolele de aplicație, fraza de acces și setările Sync rămân pe dispozitiv și nu sunt niciodată în copie. Pe web, o conexiune Google Drive reținută păstrează doar numele contului (și propriul tău client id, dacă ai dat unul), iar autentificarea Google durează o vizită. În aplicația Android, autentificarea Google Drive trece prin Google Play services de pe telefon, rulate de Google.
- <!--i:sliders--> **Când.** Doar după ce activezi **Sync across my devices** sau apeși **Sync now**: o încărcare la scurt timp după fiecare schimbare și când părăsești aplicația, plus o verificare pentru o copie mai nouă la pornirea aplicației. Dacă este blocat, Sync eșuează și spune de ce, iar munca ta rămâne pe dispozitiv. Poți în schimb să-ți exporți datele într-un fișier și să le muți singur. [Sincronizează-ți dispozitivele](/info/sync.html) acoperă funcția.
:::

::: details Pagini web, capturi și imagini de pe alte site-uri
- <!--i:monitor--> **Un URL pe care ceri unui instrument să îl captureze.** Instrumentul URL screenshot cere exact adresa pe care o tastezi, doar când pornești captura. Pentru că alegi adresa în acel moment, ea nu face parte din politica de conexiuni, iar un operator nu o poate permite sau bloca după gazdă; ca să o elimini, elimină instrumentul.
- <!--i:globe--> **O pagină web într-o casetă Design.** Pagina este cerută, cu adresa ta IP, de la site-ul din care provine, împreună cu tot ce cere pagina însăși. Unde browserul permite, cadrul nu primește cookie-uri și nicio adresă în afară de originea proprie a aplicației, deci documentul tău și linkul lui nu călătoresc niciodată cu cererea. În aplicația web pot fi încadrate doar aceste playere: `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com` (hărți) și `www.figma.com`, plus pagini de referință de pe `wikipedia.org` și `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org` și `www.openstreetmap.org`. **Allow pages from any site**, la **Settings → Trusted sites**, reîncarcă Lolly pe dispozitivul tău sub o politică ce poate încadra orice pagină `https:`, iar aceleași reguli de încredere și de întrebare se aplică în continuare. O pagină se încarcă doar pentru un site din Trusted sites, inclusiv valorile implicite de referință care pot fi eliminate, sau după ce aprobi acea casetă în inspectorul ei; un deck primit de la cineva arată până atunci o imagine a fiecărei pagini. Înainte de prezentare, lista oferă **Just this time** și **Always trust** pentru fiecare site, iar în timpul prezentării nu se întreabă nimic. Dacă este blocat, caseta își arată imaginea cu un link pentru a deschide pagina într-o filă nouă. Instrumentele Lolly și demo-urile Sandbox dintr-o casetă rulează la propria adresă a aplicației și nu contactează pe nimeni.
- <!--i:sliders--> **Schimbarea unei pagini pe care o arăți.** Acțiunea **Use page** a unei casete de pagină web îți permite să respingi cookie-uri sau să închizi un banner în pagină. Pentru paginile Lolly accesibile, **Hide cookie banners** ascunde suprapunerile cunoscute, inclusiv OneTrust, fără să accepte cookie-uri și fără să schimbe alegerea de consimțământ a site-ului. **Page CSS** schimbă pagina live și prezentarea acelei casete; exporturile folosesc în continuare posterul ales. Regulile nu pot importa resurse sau fonturi, iar browserele împiedică Lolly să schimbe CSS-ul altui site. Previzualizările Sandbox au propriul editor CSS la **Edit in Sandbox**.
- <!--i:code--> **Resursele web ale unui demo Sandbox.** Fiecare foaie de stil, script, font sau imagine la care trimite codul demo-ului este cerută, cu adresa ta IP și fără cookie-uri, de la site-ul care o găzduiește; fișierele numite de o foaie de stil preluată, precum fișierele de font Google Fonts, contează ca site-uri separate. Se întâmplă doar după ce faci clic pe **Fetch & inline** sau pentru un site din Trusted sites; **Always trust** de lângă un fișier adaugă site-ul lui în acea listă. Dacă este blocat, demo-ul rulează fără acele fișiere, iar Sandbox listează fiecare fișier pe care nu l-a putut prelua și de ce.
- <!--i:download--> **Adaugă o imagine dintr-un URL.** **Add from URL** din selectorul de resurse sau din Assets cere exact adresa de imagine pe care o lipești. Politica proprie a aplicației web împiedică browserul să preia direct de pe alt site, deci un mic intermediar la propria adresă a aplicației (`/api/fetch-image`) preia imaginea și returnează doar octeții; nu stochează nimic, uită adresa și refuză orice nu este o adresă publică de imagine. Aplicațiile desktop preiau adresa direct. Un link Lolly lipit nu este preluat deloc: se randează pe dispozitiv. Dacă operatorul oprește intermediarul (`LOLLY_DISABLE_IMAGE_PROXY=1`), în aplicația web se pot adăuga doar linkuri Lolly, imagini `data:` și imagini de aceeași origine, iar aplicațiile desktop nu sunt afectate.
- <!--i:palette--> **Un sistem de design dintr-un site web.** Design System Setup poate citi o pagină dintr-un site pe care îl indici, prin [extensia de browser](#the-browser-extension) sau prin preluarea proprie a aplicației desktop, niciodată printr-un server Lolly. Nimic nu este preluat înainte să apeși, iar linkurile din pagină nu sunt urmate.
:::

::: details Lucrul cu alte persoane și cu agenți
- <!--i:link--> **Un collab privat.** Două dispozitive se conectează direct, fără server la mijloc. Invitația și răspunsul poartă adresele pe care fiecare dispozitiv le vede în propria rețea, iar această versiune nu configurează niciun server extern de descoperire a adreselor, deci dă-le doar persoanei cu care lucrezi. Vezi [Lucrul împreună](/info/collaborate.html).
- <!--i:monitor--> **Nearby**, în aplicația desktop. Cât timp ești vizibil, adică zece minute de la pornirea unei invitații de collab sau, dacă activezi asta, oricând rulează aplicația, aplicația anunță în rețeaua locală un nume aleatoriu, numele afișat ales de tine și tipul dispozitivului. Nu anunță nicio adresă de email, cont sau identificator durabil.
- <!--i:link--> **Invită un agent.** Starea documentului invitat, previzualizările cerute de agent, identitatea agentului și editările lui trec prin releul live configurat (`lolly.ing` pe lolly.tools) către agentul pe care îl inviți. Un plugin găzduit instalat transmite apelurile și prin conectorul lolly.tools către releul selectat de invitație; conectorul nu păstrează nicio invitație sau document între apeluri. Releul ține invitațiile și cererile în așteptare în memorie până te deconectezi sau expiră: zece minute pentru o invitație nefolosită și treizeci de minute fără activitate pentru una acceptată. Furnizorul agentului tău tratează datele primite conform propriei politici. Se întâmplă doar după ce creezi o invitație în Share și dai instrucțiunile ei agentului tău; accesul de citire permite inspecția, iar accesul de editare permite și modificări. Pause oprește modificările, iar Disconnect sau revocarea invitației încheie accesul. Dacă este blocat, agentul nu se poate alătura sau continua, iar tu continui să editezi.
- <!--i:cpu--> **Allow AI control**, în aplicația desktop. Un agent care rulează pe acest computer poate citi și edita documentul Design deschis printr-o conexiune care rămâne pe computer. Este oprit până îl pornești. Lolly nu trimite nimic la vreun server pentru asta; furnizorul agentului tratează ce citește agentul conform propriei politici. [Model de amenințări și limite de încredere](/info/threat-model.html) listează ce poate și ce nu poate face un astfel de agent.
- <!--i:server--> **O instanță la distanță.** Când îndrepți aplicația către o altă instalare Lolly, ea primește tot ce servește acea instanță, prin aceeași sincronizare de catalog, plus o etichetă de versiune în cererile către ea (tipul aplicației și versiunea motorului, aceleași informații pe care le poartă un user agent), ca operatorul ei să vadă ce versiuni Lolly sunt în uz. Pe o instanță administrată, cât timp ești autentificat, eticheta poartă și un id de instalare pentru acest dispozitiv, ca lista de dispozitive a operatorului să poată distinge instalările; la ieșire id-ul este șters, iar un dispozitiv care se reconectează mai târziu prezintă unul nou. Gazda o alegi tu, deci nu este în politica de conexiuni. Dacă este blocat, comutarea eșuează, iar instanța ta locală nu este afectată.
- <!--i:people--> **Instanța Lolly Work a organizației tale.** Identitatea de autentificare și informațiile despre dispozitiv, cererile de politici, sesiunile comune, editările de colaborare, încărcările, trimiterile spre aprobare și fișierele de livrare pe care le folosești, plus etichetele de evenimente de utilizare permise, unde sunt configurate, merg la instanța organizației tale, cu autentificarea prin furnizorul ei de identitate. Reîmprospătările de politici și telemetria activată pot rula în timpul utilizării; munca comună, collab-urile, revizuirea și livrarea trimit conținut ca parte din acele fluxuri. Dacă este blocat, acele funcții ale organizației nu se pot finaliza, iar munca ta personală rămâne separată. Vezi [Servicii ale organizației cu Lolly Work](#organisation-services-with-lolly-work).
:::

### Fiecare gazdă fixă, într-un singur tabel

Content Security Policy a aplicației web este ceea ce împiedică un script să ajungă la orice gazdă pe care nu o listează. Pe lângă propria adresă a aplicației, tabelul dă fiecare gazdă din acea politică, plus cele două gazde LinkedIn pe care le adaugă aplicațiile desktop, marcate ca doar pentru desktop. Un test CI verifică acest tabel față de politica instalată, deci o gazdă nu poate fi adăugată într-una fără cealaltă.

| Ce | Ce pleacă de fapt de pe dispozitivul tău | Gazde |
|---|---|---|
| Modele locale în aplicațiile împachetate și fișiere de versiuni | O cerere pentru un fișier public, cu adresa ta IP | `lolli.li` |
| Google Fonts | Numele familiei de font și adresa ta IP | `fonts.googleapis.com`, `fonts.gstatic.com` |
| Send to și Sync cu Google Drive | Fișierul sau copia de siguranță aleasă de tine | `www.googleapis.com` |
| Send to și Sync cu Dropbox | Fișierul sau copia de siguranță aleasă de tine | `api.dropboxapi.com`, `content.dropboxapi.com` |
| Send to și Sync cu OneDrive | Fișierul sau copia de siguranță aleasă de tine și numele tău afișat pentru eticheta contului | `login.microsoftonline.com`, `graph.microsoft.com`, `api.onedrive.com` |
| Căutarea orașelor din Meeting Planner | Fiecare nume de oraș | `geocoding-api.open-meteo.com` |
| Profiluri ICC de tipar | O cerere pentru un profil public | `registry.color.org`, `www.color.org` |
| Radio pe internet | O cerere de listă de redare și un flux audio | `api.somafm.com`, `*.somafm.com` |
| Invită un agent și spațiul de lucru lolly.ing | Starea documentului invitat, previzualizările și editările, plus cererile de spațiu de lucru pe care le faci | `lolly.ing` |
| Playere într-o casetă web Design | O cerere pentru pagină, cu adresa ta IP | `www.youtube-nocookie.com`, `player.vimeo.com`, `www.loom.com`, `www.google.com`, `www.figma.com` |
| Pagini de referință într-o casetă web Design | O cerere pentru pagină, cu adresa ta IP | `wikipedia.org`, `*.wikipedia.org`, `commons.wikimedia.org`, `upload.wikimedia.org`, `www.wikidata.org`, `www.mediawiki.org`, `www.openstreetmap.org` |
| Send to LinkedIn, doar în aplicațiile desktop | Fișierul, cu numele lui ca postare publică | `www.linkedin.com`, `api.linkedin.com` |

Lista proprie a aplicațiilor desktop include și endpoint-ul de tokenuri al Google pentru autentificarea Drive. Orice altă gazdă, precum un server Mastodon sau Nextcloud pe care îl indici, necesită aprobarea operatorului, așa cum este descris la Fișiere pe care le trimiți. Gazdele alese în momentul folosirii, precum un URL pe care îl capturezi sau o instanță la distanță pe care o indici, nu apar în nicio listă.


**Semnăturile SEAL nu fac nicio cerere.** Verify poate verifica semnături SEAL, o schemă a cărei cheie de semnare poate fi publicată în DNS. Browserele nu pot face interogări DNS, deci o căutare web ar trebui să treacă printr-un resolver DNS-over-HTTPS terț, care ar vedea domeniul verificat și adresa ta IP. Lolly folosea resolverul Cloudflare; nu îl mai folosește, iar nimic nu l-a înlocuit. Nicio aplicație Lolly nu caută astăzi chei SEAL: aplicațiile desktop și mobile rulează aceeași vedere Verify, iar `lolly validate` din linia de comandă nu verifică SEAL. Un fișier a cărui înregistrare SEAL poartă cheia inline este verificat offline, iar Verify numește semnătura consistentă intern, fără a confirma domeniul. Un fișier a cărui cheie există doar în DNS arată **SEAL signature did not verify**, cu motivul „no key resolver and no inline key”.

![Ecranul Verify: o țintă de plasare și nimic altceva - fișierul este verificat acolo unde se află deja, fără încărcare și fără cont](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop)

Poți verifica singur aceasta și orice altă afirmație de pe această pagină: [Verifică singur](/info/verify-yourself.html) dă comenzile și rezultatul așteptat.

## Servicii pe care le rulează lolly.tools

Acestea rulează pe lolly.tools pentru toată lumea. Fiecare primește doar ce îi trimiți. [Suprafața serverului](/info/server-surface.html) descrie aceleași componente așa cum funcționează în orice instalare.

### Linkuri de randare

Fiecare URL `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` randează pe bune, iar intrările lui călătoresc în URL, deci un link Lolly partajat poate apărea ca imagine live într-un README, un wiki sau un dashboard. Preluarea unuia cere serverului să randeze **date publice de instrumente și catalog** cu intrările scrise în adresă.

- <!--i:usercheck--> **Fără conturi, fără cookie-uri, fără stare.** Ruta nu cere autentificare și nimic de pe dispozitivul tău nu este citit. Documentele, sesiunile și încărcările tale nu părăsesc niciodată browserul și nu pot apărea în aceste linkuri.
- <!--i:document--> **URL-ul însuși este înregistrat.** Șirul de interogare al unui URL face parte din cerere, deci apare în jurnalele obișnuite de acces ale platformei de găzduire, ca orice cale cerută. Dacă intrările unui link conțin numele sau adresa de email a cuiva, cum ar fi un ecuson de nume sau o semnătură de email, **acel text se află în jurnale**. Dă unui link de randare doar ce ai pune pe o pagină publică.
- <!--i:globe--> **Intrările sunt oricum publice.** Sunt tot ce a tastat autorul linkului în URL, lizibil de oricine ajunge la link. Nu pune secrete într-un link partajat; Lolly oferă criptarea linkurilor pentru conținut sensibil.
- <!--i:eyeoff--> **În cache, limitate și neindexate.** Răspunsurile sunt păstrate în cache și limitate ca rată ca orice imagine publică și marcate `noindex`, ca motoarele de căutare să lase randările tale deoparte.

O instalare găzduită propriu care nu vrea o rută publică de randare setează `LOLLY_DISABLE_RENDER_GET=1`, iar fiecare dintre aceste URL-uri returnează 404.

### Preluarea de imagini și intermediarul Penpot

**Add from URL** din aplicația web și **Send to Penpot** folosesc doi mici intermediari pe lolly.tools, descriși la [Fiecare cerere de rețea pe care o poate face aplicația](#every-network-request-the-app-can-make). Preluarea de imagini nu păstrează nimic și uită adresa. Intermediarul Penpot transmite tokenul și arhiva către Penpot și nu păstrează niciuna; înregistrează numele comenzii și starea răspunsului Penpot.

### Serverul MCP, pentru agenți AI

Un agent AI poate ajunge la Lolly prin Model Context Protocol, printr-un endpoint rulat de un operator. lolly.tools rulează unul, iar oricine își poate rula propriul, inclusiv complet offline.

- <!--i:cpu--> **Fișierele pe care le trimite un agent.** Instrumentele care primesc un fișier (`lolly_transform`, `lolly_verify`, `lolly_redact`, `lolly_read`, `lolly_check`, `lolly_package`, `lolly_compose`, `lolly_rebrand` și instrumentele de imagine `lolly_look`, `lolly_sample_color` și `lolly_trace_edges`) îl procesează în memorie și returnează rezultatul în același apel. Fișierul nu este scris niciodată pe disc și nu este păstrat după finalizarea cererii. `lolly_inspect` primește și el un fișier, iar verificările lui video și de producție tipar scriu o copie de lucru temporară, ștearsă când apelul returnează. Orice alt instrument lucrează din parametrii apelului: text, numere, culori, URL-uri, id-uri de resurse din catalog sau un document furnizat de apelant.
- <!--i:cpu--> **Rebrand spune unde merge un deck.** Prima etapă a `lolly_rebrand`, `capabilities`, spune în cuvinte unde ar merge octeții tăi înainte să trimiți ceva: pe un server local găzduit propriu, deck-ul nu părăsește niciodată acea mașină, iar pe un server găzduit, apelarea `lolly_rebrand` trimite deck-ul acolo, până la limitele de dimensiune și de diapozitive date de acea etapă.
- <!--i:lock--> **Endpoint-ul deschis.** Pe lolly.tools, `lolly.tools/api/mcp` este deschis oricui, fără token. Apelurile sunt limitate pe adresă și printr-un buget zilnic. Adresa devine un digest pseudonim în depozitul de control al abuzului, ca la endpoint-urile de autentificare de mai jos, iar bugetul numără doar timpul CPU și octeții trimiși, fără adresă. Tokenul bearer al unui endpoint restricționat nu este scris niciodată într-un jurnal sau într-un URL de randare.
- <!--i:link--> **Linkuri de descărcare pentru rezultate mari.** lolly.tools returnează rezultatele inline și nu emite niciodată aceste linkuri. Un operator le poate activa pentru propriul gateway autentificat, unde un rezultat este ținut cel mult cinci minute și doar tokenul bearer al apelantului îl poate prelua; vezi [Serverul MCP](/info/mcp.html#private-download-links-for-large-results). Un endpoint restricționat planificat la `mcp.lolly.tools` ar primi un token bearer emis de operator clienților de încredere, sau OAuth 2.1 cu tokenuri semnate de scurtă durată verificate față de un secret comun; activarea lui este în așteptare și este listat la [Gazde de livrare și procesatori](#delivery-hosts-and-processors).

### Identitate verificată: o autentificare pornită de tine

Lolly poate sigila un **Content Credential** în exporturile tale, ca oricine să poată verifica offline că un fișier este neschimbat de când a părăsit Lolly. Atât este **activ implicit și complet local**: cheia de semnare este creată pe dispozitivul tău, iar semnarea are loc offline. Fără înrolare, acea cheie este de unică folosință, o pereche de chei nouă creată pentru fiecare export și apoi aruncată. După ce te înrolezi, cheia durează și este generată **non-extractibilă**, deci nici codul propriu al Lolly nu o poate citi, ci doar îi poate cere să semneze. În ambele cazuri nu părăsește niciodată dispozitivul tău.

[Exportul](/info/exporting.html#content-credentials-c2pa) listează ce înregistrează o credențială: instrumentul, ora, suprafața grosieră de export, numele tău doar când ai activat *Use my details*, lucrările creditate pe care le plasează un export și fiecare cântec Rondocode pe care îl redă un export video sau audio (numele lui, un hash al sursei și cum a randat sandbox-ul Lolly cântecul). Panoul de export listează acele cântece înainte să exporți.

Credențiala și metadatele fișierului înregistrează și [sistemul de design și colourway-ul](/info/exporting.html#the-design-system-record) care a desenat exportul: id-ul și numele sistemului de design, versiunea lui publicată și colourway-ul. Numele unui sistem de design este text tastat de proprietarii lui și poate fi numele unui client, deci cardul **Design system** din panoul de export arată cuvintele exacte înainte să exporți. Debifează cardul sau folosește `_madewith=0` ori `--no-madewith` ca să le omiți.

Singurul pas *opțional* peste acestea este înrolarea unei identități verificate, ca exporturile tale să spună „Verified - signed by \<your email\>” în loc să numească o cheie anonimă. **Dacă sari peste înrolare, serviciul de certificate nu primește de la tine nicio dată de înrolare.**

![Cardul Verified identity din Settings, la lățime de telefon: selectorul duratei certificatului și pasul de înrolare de dedesubt, inactiv până îl pornești tu](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Dacă te înrolezi, exact asta se întâmplă:

::: timeline
- <!--i:usercheck--> **Alegi o metodă de autentificare**: GitHub, Google, SUSE (id.suse.com) sau un link trimis pe email. Pentru cei trei furnizori OIDC mergi la pagina proprie de autentificare a furnizorului, sub politica lui de confidențialitate, nu a noastră, iar serviciul de certificate primește înapoi doar o adresă de email verificată și numele furnizorului. Pentru linkul pe email, adresa pe care o tastezi merge la **Resend**, un serviciu de email tranzacțional, doar ca să livreze acel link.
- <!--i:lock--> **Un cookie de scurtă durată protejează redirecționarea.** Serviciul de certificate setează `lolly_ca_state`, `HttpOnly`, cu domeniul `/api/ca` și expirând în zece minute. Poartă o valoare aleatorie, nu un identificator de urmărire, există doar ca să împiedice falsificarea redirecționării de autentificare și este șters imediat ce autentificarea se încheie.
- <!--i:eyeoff--> **Adresa ta IP este folosită scurt pentru a preveni abuzul** endpoint-urilor de autentificare, ca un singur script să nu poată inunda o căsuță poștală sau epuiza cota de email. Lolly o transformă într-un digest SHA-256 înainte să ajungă în depozitul de control al abuzului, de scurtă durată, deci adresa brută nu este trimisă acolo. Digestul este pseudonim, nu anonim: cine deține depozitul ar putea recupera o adresă IPv4 încercând-o pe fiecare posibilă. Găleata expiră după aproximativ un minut și nu este folosită pentru altceva. Jurnalele obișnuite de acces ale găzduirii sunt separate și descrise mai jos.
- <!--i:seal--> **Serviciul emite un certificat** care leagă adresa ta de email verificată de cheia publică a dispozitivului tău. Cheia privată rămâne pe dispozitiv: clientul trimite o cerere de certificat cu o dovadă legată de posesie, iar nicio cheie privată a dispozitivului nu merge la vreunul dintre modurile de emitent.
- <!--i:check--> **Semnarea rămâne locală.** Cu emitentul legacy, un export nu necesită nicio cerere către serviciul de certificate. O identitate administrată necesită și o listă de revocare proaspătă și semnată de la emitentul ei; clientul poate folosi o listă din cache în fereastra configurată de prospețime, iar reîmprospătarea ei poate contacta serviciul de certificate în timpul unui export. O stare lipsă, expirată sau invalidă oprește folosirea identității administrate.
:::

::: details Păstrare și rechemare în fiecare mod de emitent
**Emiterea găzduită legacy** oferă 7, 30, 90 sau 365 de zile, plafonate de operator. Nu păstrează niciun inventar de identități și niciun jurnal de emitere, deci nu poate căuta cine a obținut un certificat și nici nu poate revoca certificatele acelei persoane; durata de viață este rechemarea.

**Emiterea administrată pentru organizație** folosește o durată implicită de cel mult 24 de ore și un maxim de șapte zile, cu propria rădăcină și politică de încredere în emitent, iar semnarea merge la emitentul Vault configurat de operatorul ei. Aplicația ei de înrolare folosește un depozit comun de admitere cu o singură utilizare, care păstrează doar un identificator de autentificare cu cheie și un digest al cererii, cel mult zece minute, și nu stochează niciun inventar de identități sau cache de răspunsuri de certificate. Furnizorul PKI, dispozitivele lui de audit, gateway-urile și copiile de siguranță au propriile fluxuri de date. Chiar și cu stocarea obișnuită a emiterii oprită, revocarea bazată pe certificate poate păstra certificatul, inclusiv identitatea lui de email, iar serialele de revocare și identificatorii de audit pot rămâne legabile; politica operatorului tău decide acel inventar, cine îl poate accesa și cât timp este păstrat.

Un dispozitiv administrat poate cere să-și revoce propriul certificat, cu o dovadă autentificată a dispozitivului, și nicio API nu cere cheia privată a dispozitivului. Operatorul poate retrage un emitent prin politica de încredere. Lolly nu păstrează nicio mapare între persoane și certificate, deci revocarea certificatelor unei persoane la plecarea ei depinde de înregistrările păstrate de operator, iar înregistrările PKI, cele de audit, destinatarii și copiile de siguranță urmează politica operatorului. [Designul serviciului de certificate](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md) acoperă custodia emitentului, păstrarea de către furnizor și calificarea.
:::

## Servicii ale organizației cu Lolly Work

**Lolly Work** este serviciul opțional pentru organizații al proiectului Lolly, instalat separat de fiecare organizație care rulează o instanță. Conectarea la o instanță adaugă date păstrate pe acel server, pe lângă editarea ta locală. Operatorul ei răspunde de politica de confidențialitate, controalele de acces, destinatarii, păstrarea și copiile de siguranță ale acelei instalări.

| Flux de lucru | Date tratate de serviciul organizației |
|---|---|
| Autentificare și provizionare | Revendicări ale furnizorului de identitate, apartenența la cont și grup, sesiuni de autentificare și informații despre dispozitiv. OIDC tratează autentificarea; administratorii pot proviziona și dezactiva conturi prin SCIM |
| Catalog și proiecte comune | Resurse încărcate, metadate și versiuni; proiecte și sesiuni comune; conținut preluat de la furnizori de bibliotecă configurați |
| Collab-uri Work | Starea sesiunii comune, editări live și prezența participanților trimise prin instanță; starea salvată persistă conform politicii ei de stocare |
| Linkuri de partajare administrate | Ținta linkului și setările de acces, precum expirarea și protecția opțională cu parolă; cererile se rezolvă prin instanță și pot fi revocate |
| Revizuire și livrare | Conținut trimis, decizii de aprobare, destinația selectată, fișiere pregătite și confirmări de livrare |
| Randări și loturi pe server | Intrările instrumentelor trimise, cereri de randare, stare și fișiere de ieșire păstrate. Aceste joburi rulează pe server, nu pe dispozitivul tău |
| Raportarea utilizării | Etichete de evenimente din lista permisă, precum id-ul instrumentului, formatul și id-ul resursei, conform politicii de telemetrie de mai jos |
| Audit | Înregistrări de actor și acțiune pentru operațiunile guvernate, păstrate separat de telemetria de utilizare |

Serviciul folosește cookie-uri de autentificare, inclusiv `lw_session` pentru membrii autentificați și `lw_guest` pentru accesul de oaspete, unde este activat, separate de cookie-ul serviciului de certificate. Reîmprospătările de politici și raportarea de utilizare activată pot face cereri cât timp aplicația este în uz, fără un clic separat pentru fiecare. Acesta este trafic către instanța configurată, nu un raport către proiectul Lolly despre instalări pe care nu le rulează.

**Telemetria de utilizare are trei niveluri.** `off` nu stochează evenimente de utilizare, `aggregate` elimină id-urile utilizatorilor, iar `standard` poate atribui evenimente. Nivelul implicit este `standard`, deci o instanță stochează evenimentele de utilizare primite, dacă operatorul ei nu alege `off`. Politica implicită de atribuire este `opt-in`, care cere consimțământul tău înainte ca un id de utilizator să fie stocat; un operator poate configura în schimb raportarea atribuită cu `telemetryAttribution: default`. Atributele permise sunt etichete, niciodată valori de intrare ale instrumentelor. Vezi [Telemetria Work](/info/work-telemetry.html).

**Auditul este separat.** Acțiunile guvernate pot păstra o înregistrare de audit identificată, indiferent de consimțământul tău pentru telemetrie. Dezactivarea telemetriei nu dezactivează stocarea sesiunilor comune, înregistrările de aprobare, stocarea joburilor de randare sau auditul. Operatorul controlează păstrarea și ștergerea, inclusiv orice pseudonimizare a jurnalului de audit; vezi [Stocarea Work și ciclul de viață al datelor](/info/work-data-lifecycle.html).

| | Dispozitivul tău | Instanța organizației tale |
|---|---|---|
| Ce conține | Munca ta personală, preferințele și cache-urile | Munca comună, conturile, încărcările, aprobările, randările, auditul și telemetria configurată |
| Cine o șterge | Tu, cu **Clear all my data** sau cu datele site-ului din browser | Operatorul, prin controalele proprii ale instanței |
| Pe cine întrebi | Pe nimeni: înregistrările sunt pe dispozitivul tău | Operatorul instanței, pentru acces, export sau ștergere |

**Ștergerea locală nu este ștergere pe server.** Părăsirea unei instanțe sau ștergerea browserului elimină starea locală, nu înregistrările sau copiile de siguranță păstrate de organizație. [Sync](/info/sync.html) personal și **Export my data** salvează dispozitivul tău, nu serviciul organizației. Demo-ul public [lolly.work](https://lolly.work) își păstrează starea doar în memorie și nu este stocare durabilă pentru munca ta.

## Extensia de browser

Extensia de browser **Lolly URL Screenshot** nu colectează pentru noi nicio dată personală. Nu are analiză, urmărire și nici server propriu. Pagina [Extensia de browser](/info/extension.html) descrie cum funcționează.

**Ce face.** Aplicația web Lolly îi poate cere o captură de ecran a unei pagini web sau conținutul unei pagini pentru a porni un sistem de design dintr-un site web. Fiecare cerere deschide în extensie o fereastră de aprobare care arată site-ul solicitant, dacă vrea o captură sau conținutul paginii și adresa paginii. Doar după ce apeși **Approve once**, extensia deschide acea pagină într-o filă temporară în fundal, face captura sau citește pagina, predă rezultatul filei Lolly care a cerut-o și închide fila. Fiecare cerere are nevoie de aprobarea ei.

**Date.**

- <!--i:shieldcheck--> **Nu colectăm nimic.** Rezultatul merge doar la pagina Lolly care l-a cerut, în același browser. Extensia nu stochează conținutul paginilor și nu adaugă alt destinatar.
- <!--i:globe--> **Cereri de rețea.** Pagina pe care o aprobi se încarcă așa cum ar face-o în orice filă, împreună cu tot ce cere pagina însăși. Citirea conținutului unei pagini preia și foile de stil ale acelei pagini și câteva imagini de pictogramă și logo, din interiorul paginii, iar acele preluări nu trimit cookie-uri către alte site-uri. Extensia nu face alte cereri și niciuna nu merge la un server Lolly.
- <!--i:lock--> **Sesiunea ta de browser.** Pagina se încarcă cu sesiunea ta de browser, ca și cum ai deschide-o singur, deci o pagină în care ești autentificat poate pune informații private în rezultat.
- <!--i:link--> **Adresele pe care le aprobi** sunt folosite doar pentru a încărca acea pagină pentru acea cerere. Nu sunt înregistrate în jurnal și nici partajate.

**Permisiuni.**

- <!--i:wrench--> **`debugger`**: pentru a face captura prin DevTools Protocol, același mecanism pe care îl folosește aplicația desktop Lolly.
- <!--i:monitor--> **`tabs`**: pentru a deschide și închide fila temporară și pentru a verifica dacă nici pagina Lolly, nici pagina țintă nu s-au mutat de când ai aprobat.
- <!--i:code--> **`scripting`**: pentru a citi conținutul unei pagini în fila temporară, după ce aprobi acea cerere.
- <!--i:database--> **`storage`**: pentru a nota id-urile filelor temporare în session storage, ca ele să se închidă totuși dacă browserul oprește extensia în timpul unei cereri. Nu se stochează conținut de pagini.
- <!--i:check--> **Acces opțional la site-uri (`http://*/*`, `https://*/*`)**: nu este acordat la instalare. Când apeși **Approve once**, extensia cere Chrome acces la singurul site din acea cerere, iar Chrome te întreabă prima dată pentru fiecare site. Un site permis înainte are totuși nevoie de o aprobare nouă pentru fiecare cerere.

Niciuna dintre acestea nu este folosită pentru a citi, monitoriza sau transmite navigarea ta dincolo de singura cerere pe care ai aprobat-o.

## Gazde de livrare și procesatori

Fișierele publice din catalog, instrumentele și redările de afișare vin implicit de la propria adresă a aplicației. Numele adresate prin conținut schimbă de unde este preluat un fișier, nu cine primește cererea. Această funcție de livrare nu activează niciun CDN terț. Un CDN care încheie TLS ar primi detaliile cererii, inclusiv adresele IP și orice cookie-uri sau credențiale bearer transmise către el, chiar sub același nume de gazdă din browser, deci un operator care adaugă unul preia un nou procesator.

**Înainte de a adăuga orice CDN sau gazdă externă de modele**, administratorul trebuie să publice numele procesatorului, numele gazdei, jurisdicțiile, metadatele primite, păstrarea și aranjamentele de transfer. [Instalarea livrării](/info/deploy-delivery.html) listează ce trebuie dezvăluit. Răspunsurile din spațiul de lucru privat ocolesc cache-urile partajate: rezultatele personale, refuzurile de acces și erorile folosesc `private, no-store`, iar un răspuns privat permis se poate revalida în browserul tău fără să devină public.

Serviciile de referință folosesc găzduirea de mai jos. Aceasta este o listă de nume de gazdă, nu o afirmație că instanța altei organizații folosește aceeași regiune.

| Nume de gazdă sau serviciu | Funcție și destinatar | Regiune și tratarea datelor |
|---|---|---|
| lolly.tools | Aplicația publică, catalogul, randarea și serviciile de certificate; găzduire UpCloud | Frankfurt, Germania. Detaliile cererilor pot apărea în jurnalele infrastructurii; editarea locală obișnuită rămâne pe dispozitiv |
| lolly.ing | Spațiu de lucru administrat și servicii de agenți pentru documente; găzduire UpCloud | Frankfurt, Germania. Baza de date privată și stocarea de fișiere sunt pe aceeași gazdă. Conturile, conținutul comun și înregistrările serviciului urmează politica administratorului instanței |
| mcp.lolly.tools | Gateway MCP autentificat opțional, planificat, și descărcări private de rezultate; găzduire UpCloud | Frankfurt, Germania, cu același procesator de găzduire. Activare în așteptare. Gateway-ul ar primi detaliile cererilor și parametrii sau fișierele trimise de apelant |
| lolli.li | Fișiere publice de versiuni și modele; UpCloud Managed Object Storage, separat de clusterul aplicației | Frankfurt, Germania, în regiunea de stocare de obiecte europe-2 a UpCloud. O descărcare trimite detaliile cererii, nu intrările pe care le procesează ulterior modelul |
| Furnizor de identitate configurat | Google, GitHub sau un furnizor OIDC al operatorului | Autentificarea urmează politica acelui furnizor. Cere operatorului instanței numele gazdei, regiunea și aranjamentele de transfer |
| Furnizor de resurse configurat | Brandfolder sau altă bibliotecă aleasă de operator | Furnizorul primește cererile de bibliotecă permise. Permisiunile sursei și politica instanței guvernează accesul; cere operatorului numele gazdelor și regiunile |
| Înrolare prin email, când este configurată | Resend livrează linkul de autentificare cerut | Primește adresa de email de destinație pentru acel mesaj; se aplică propriii lui termeni de prelucrare |

Aplicația de referință nu folosește alt furnizor de găzduire, bază de date sau control al abuzului. Un operator poate alege alți furnizori pentru o altă instanță, iar furnizorii de găzduire, identitate, resurse și email au nevoie fiecare de propria dezvăluire. [Regiunea de stocare de obiecte](https://upcloud.com/docs/products/managed-object-storage/availability/) a gazdei de modele este verificată separat de regiunea aplicației.

**Linkuri opționale de descărcare MCP legate de principal.** Un operator poate activa linkuri de descărcare pentru rezultate mari pe un gateway autentificat, cu o singură replică. Sunt oprite implicit. Gateway-ul anonim de la `lolly.tools/api/mcp` returnează rezultate inline și nu emite niciodată aceste linkuri. Numele de gazdă restricționat planificat este `mcp.lolly.tools`, la același procesator UpCloud din Frankfurt; activarea este în așteptare, iar această pagină nu afirmă un serviciu de linkuri de descărcare în funcțiune. Linkurile nu adaugă niciun CDN terț.

Doar un apelant autentificat cu un domeniu de fișiere poate primi un link, iar bearer-ul aceluiași apelant este necesar pentru a-l prelua: folosește bearer-ul validat din apelul de randare, nu alt token al aceluiași cont. Acordarea expiră în 300 de secunde. Proprietatea și căutarea rezultatului rămân în memoria gateway-ului, iar octeții de ieșire merg în fișiere temporare private, curățate după expirare sau eliminate la oprirea curată. Repornirea gateway-ului invalidează linkurile existente. Rezultatele ținute sunt limitate la 64 MiB per bearer, 256 MiB în tot gateway-ul și 200 de fișiere în așteptare sau ținute. Bugetele zilnice de CPU și de octeți decodați numără rezultatele când sunt ținute și când sunt descărcate. Răspunsurile folosesc `private, no-store` și `Referrer-Policy: no-referrer`. Tokenul unui link nu permite, singur, altei persoane sau altui agent să citească rezultatul.

## Jurnale de infrastructură

Această secțiune descrie instalarea publică lolly.tools. Platforma ei de găzduire înregistrează detaliile obișnuite ale cererilor: adresa IP, calea cerută, marcajul de timp și user agent. Editările locale nu ajung la acea gazdă. Șirul de interogare al unui link de randare poate conține textul furnizat de apelant, așa cum s-a explicat mai sus. Instrumentele MCP pentru fișiere procesează în memorie octeții primiți. O instanță Lolly Work păstrează și înregistrările descrise mai sus, sub politica de jurnalizare a operatorului ei.

**Serviciile publice păstrează jurnalizarea aplicației la minimum.** Serverul MCP înregistrează pornirea, configurația și avertismentele de randare; nu ține un jurnal propriu al cererilor și nu înregistrează tokenuri sau adrese ale apelanților. Intermediarul Penpot înregistrează numele fiecărei comenzi și starea răspunsului Penpot, niciodată antete, tokenuri sau fișierul. Serviciul de certificate înregistrează setările de pornire și avertismentele de configurare, plus două linii reduse la eșec: un cod de stare la eșecul trimiterii, fără adresa destinatarului, și o linie fixă de eșec, fără text de eroare, stack trace sau URL, pentru că o eroare a furnizorului poate purta valori de identitate sau credențiale. Tot restul din jurnal vine de la platforma de găzduire.

Pentru lolly.tools, administratorul instanței controlează jurnalizarea cererilor, rotația și păstrarea pe UpCloud. Această pagină nu indică o perioadă maximă de păstrare a jurnalelor care nu a fost verificată. Contactează operatorul de date de mai jos pentru programul curent și pentru orice solicitare privind jurnalele păstrate pe server. Pentru altă instanță se aplică setările operatorului ei, inclusiv orice exporturi de jurnale sau alți procesatori.

## Temeiuri juridice, retenție și destinatari

Acest tabel acoperă instalarea de referință **lolly.tools**. Nu indică temeiurile juridice sau perioadele de păstrare ale instanței Lolly Work a organizației tale; operatorul ei le oferă în propria politică.

| Prelucrare | Temei juridic (GDPR Art. 6) | Păstrată timp de |
|---|---|---|
| Tot ce se află pe dispozitivul tău (documente, preferințe, cache, contoare) | **Nu este deloc prelucrarea noastră**: nu ajunge niciodată la noi. Stocarea pe dispozitivul tău este strict necesară serviciului cerut de tine (ePrivacy Art. 5(3)), deci nu necesită consimțământ | Până o ștergi |
| Adresa ta de email la înrolarea legacy găzduită pentru Content Credentials | **Art. 6(1)(b)**, executarea unui serviciu cerut explicit de tine | Niciun inventar de identități sau jurnal de emitere în serviciul legacy; emailul este folosit în timpul cererii și inclus în certificatul tău. Păstrarea PKI-ului administrat al organizației, a auditului și a revocării urmează politica operatorului ei |
| Un digest SHA-256 pseudonim făcut din adresa ta IP, pentru limitarea ratei la endpoint-urile de autentificare și la cele publice de randare, imagini și MCP | **Art. 6(1)(f)**, interesul nostru legitim de a preveni abuzul unui serviciu gratuit și al cotei de email a unui terț. Considerăm că trece testul de echilibrare, deoarece adresa brută nu este trimisă limitatorului, digestul este folosit doar pentru controlul abuzului și expiră de la sine | Aproximativ un minut în depozitul de control al abuzului; nu este păstrat după aceea |
| Jurnale de acces ale găzduirii (IP, cale, marcaj de timp, user agent) | **Art. 6(1)(f)**, interesul nostru legitim pentru securitatea serviciului, prevenirea abuzului și diagnosticarea defecțiunilor | Rotație și păstrare configurate de administrator; contactează operatorul de date pentru programul curent |

**Destinatari.** Categoriile de destinatari sunt furnizorul nostru de găzduire (UpCloud), care găzduiește baza de date a aplicației și depozitul de control al abuzului, și, doar dacă folosești opțiunea de autentificare prin email, un furnizor de email tranzacțional (Resend). Depozitul de control al abuzului primește doar digesturi de scurtă durată, niciodată adresa IP brută. Dacă te autentifici cu GitHub, Google sau SUSE (id.suse.com), te ocupi direct cu acel furnizor, sub propria lui politică de confidențialitate, iar el ne comunică o adresă de email verificată și nimic altceva. Nu partajăm date personale cu nimeni altcineva și nu vindem date, nu facem publicitate și nu creăm profiluri ale utilizatorilor.

**Transferuri în afara SEE.** Găzduirea, baza de date și stocarea de fișiere ale aplicației de referință sunt în Frankfurt. Furnizorii opționali de identitate, email și resurse au propriile locații și termeni de prelucrare, care pot include acces din afara SEE, iar regiunea unui server nu stabilește singură jurisdicția fiecărui destinatar. Contactează operatorul de date pentru acordurile cu furnizorii și aranjamentele de transfer aplicabile; pentru altă instanță, întreabă operatorul ei. [Clauzele contractuale standard](https://commission.europa.eu/law/law-topic/data-protection/international-dimension-data-protection/standard-contractual-clauses-scc_en) ale Comisiei Europene sunt o garanție disponibilă pentru astfel de transferuri; această pagină nu afirmă că un acord neverificat cu un furnizor le folosește.

**Luarea automată a deciziilor.** Niciuna. Nu există profilare și nici decizie automată cu efecte juridice sau similar de semnificative (Art. 22).

## Confidențialitatea copiilor

Folosirea locală obișnuită a aplicației nu trimite conținut personal la lolly.tools. Înrolarea sa opțională pentru Content Credentials primește o adresă de email și nu se adresează copiilor și nu este destinată lor. Serviciile organizației au propriile conturi și propria tratare a datelor, sub politica operatorului lor.

## Drepturile tale

Pentru înregistrările stocate doar pe dispozitivul tău, poți accesa, corecta, șterge și muta datele singur. Ele se află în spațiul de stocare al browserului sau al aplicației, într-o formă pe care o poți inspecta, exporta (**Export my data**, mai sus) sau șterge (**Clear all my data** sau datele site-ului din browser).

Formal, conform articolelor 15-22 din GDPR, ai dreptul de **acces** la datele tale personale, de **rectificare**, de **ștergere**, de **restricționare** sau de **opoziție** față de prelucrarea lor (inclusiv față de orice întemeiem pe interese legitime), la **portabilitatea datelor** și, unde prelucrarea se bazează pe consimțământ, de a-ți **retrage consimțământul oricând**, fără a afecta legalitatea celor întâmplate înainte de retragere.

Serviciul public de certificate nu păstrează niciun jurnal de emitere. Jurnalele infrastructurii pot conține detalii ale cererilor, deci această politică nu promite că mediul de găzduire nu deține date personale. Contactează operatorul de date pentru acces, ștergere sau altă solicitare privind acele înregistrări; îți vom explica ce înregistrări există și ce se poate face. Pentru munca, identitățile, telemetria și înregistrările de audit păstrate de o organizație, contactează operatorul tău Lolly Work, pentru că controalele locale de export și ștergere nu ajung la acele copii.

**Ai dreptul să depui o plângere.** Dacă crezi că ți-am tratat datele necorespunzător, poți depune o plângere la o autoritate de supraveghere a protecției datelor: în UE, autoritatea din țara ta de reședință, de la locul de muncă sau de unde crezi că a avut loc încălcarea (Art. 77). Autoritatea noastră principală de supraveghere este *Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) din Ansbach, Germania. Nu trebuie să ne contactezi mai întâi, deși ne-ar plăcea să avem ocazia de a rezolva problema.

## Modificări aduse acestei politici

Data de sus se schimbă ori de câte ori se schimbă acest document. O modificare care schimbă ce pleacă de pe dispozitivul tău sau ce se păstrează primește aici propria linie, nu o editare tăcută. Ca să vezi ce s-a schimbat, întreabă (mai jos) sau compară cu [sursa publică](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

**29 septembrie 2026:** am clarificat serviciul opțional lolly.work, conținutul păstrat de organizație, cookie-urile de autentificare, telemetria de utilizare și înregistrările de audit, precum și separarea dintre ștergerea locală și păstrarea pe server. Acestea sunt fluxuri opționale existente, nu o nouă cerință de încărcare pentru editarea locală.

**11 octombrie 2026:** am înlocuit descrierea găzduirii Vercel retrase cu inventarul numelor de gazdă UpCloud ale aplicației, am distins furnizorii opționali de identitate și de resurse și am descris livrarea adresată prin conținut și modul de descărcare MCP cu rezultate ținute. Această modificare nu activează niciun CDN terț. Păstrarea jurnalelor este controlată de administrator, nu de o valoare implicită stabilită de un plan Vercel.

**22 octombrie 2026:** am corectat descrierea comportamentului existent. Secțiunea despre extensia de browser acoperă acum fereastra de aprobare pentru fiecare cerere, accesul la site cerut pe rând pentru un singur site și preluările de foi de stil și pictograme la citirea unui site. Au fost corectate și: rândurile Send to Google Drive și Meeting Planner, nota SEAL (nicio aplicație Lolly nu caută chei SEAL în DNS), nivelul implicit de telemetrie de utilizare al serviciului organizației, instrumentele MCP de imagine și jurnalizarea aplicației pentru serviciile publice. Software-ul în sine nu s-a schimbat.

**23 octombrie 2026:** am reorganizat politica după ce pornește fiecare cerere și am descris comportamente existente pe care nu le acoperea înainte: invitațiile private de collab care poartă adrese de rețea locală, Nearby în aplicația desktop, Allow AI control, citirea unui sistem de design dintr-un site web, seturile de emoji, cache-ul local al căutărilor de orașe din Meeting Planner, Coșul și celelalte înregistrări listate în Settings → Storage. Am corectat două afirmații: Bluesky și Discord nu sunt doar pentru desktop, iar fiecare gazdă aleasă de o persoană pentru trimitere necesită aprobarea operatorului atât în aplicația web, cât și în cea desktop; digestul de limitare a ratei al unei adrese IP este pseudonim, nu anonim. Software-ul în sine nu s-a schimbat.

## Cine este responsabil și cum ne poți contacta

**Operatorul de date** pentru lolly.tools este:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Germania

SUSE a numit un **responsabil cu protecția datelor**, care poate fi contactat la [privacy@suse.com](mailto:privacy@suse.com). Folosește acea adresă pentru orice solicitare formală conform secțiunii „Drepturile tale” de mai sus.

Pentru orice despre Lolly în sine, precum cum funcționează, de ce este ceva așa cum este sau o corectură la acest document, contactează-l pe **Andy Fitzsimon**, [fitzy@suse.com](mailto:fitzy@suse.com).

Pentru o instanță Lolly găzduită propriu sau enterprise, contactează în schimb pe cel care o operează: operatorul este responsabilul de date pentru propria instalare. SUSE și proiectul open source Lolly nu dețin date pentru instalările pe care nu le rulează.
