# Politica de confidențialitate

*Ultima actualizare: 11 august 2026*

> **Versiunea pe scurt.** Documentele, imaginile, videoclipurile și fișierele pe care le creezi în Lolly rămân
> pe dispozitivul tău. Nu există conturi pentru utilizarea obișnuită, nu există cookie-uri din partea aplicației
> însăși și nu există nicio analitică sau elemente de urmărire nicăieri în codul sursă - nu spunem doar "nu folosim
> datele", chiar nu sunt prezente în cod. Există o listă scurtă și completă de
> excepții pentru cazurile în care software-ul comunică deloc cu o rețea, și fiecare
> dintre ele este descrisă mai jos în detaliu: ce pleacă, către cine și când. Singura
> excepție care implică ceva personal este o autentificare pe care trebuie s-o pornești
> tu însuți, explicit. Dacă nu este în acest document, nu se întâmplă.

## Ce acoperă această politică

Lolly este software open-source - un engine, mai multe shell-uri de aplicație (web, desktop,
mobil, CLI) și o extensie de browser - pe care oricine îl poate rula. Această politică are două
părți:

- <!--i:code--> **Software-ul în sine**: ce face și ce nu face cu datele tale, indiferent unde
  rulează. Este o proprietate a codului, deci e adevărat pentru orice implementare Lolly,
  a noastră sau a oricui altcuiva.
- <!--i:server--> **lolly.tools**, implementarea de referință operată de SUSE: alegerile specifice
  făcute la rularea pieselor sale opționale server-side (ce se loghează, pentru cât timp, de
  cine).

Dacă folosești o instanță Lolly self-hosted sau enterprise, comportamentul software-ului de mai
jos rămâne valabil, dar *operatorul* acelei instanțe - nu SUSE - este
responsabil pentru orice e server-side: endpoint-ul lor de randare, serverul lor MCP,
autoritatea lor de certificare Content Credentials, dacă rulează una. Cere-le lor
propria politică. Vezi [Adoptare și guvernanță](/info/adoption-governance.html) pentru
ce implică operarea Lolly.

## Aplicația: ce rămâne pe dispozitivul tău

Shell-urile web, desktop și mobil ale Lolly rulează întregul engine de randare pe client.
Deschiderea unui tool, completarea intrărilor, previzualizarea și exportul se întâmplă toate pe
dispozitivul tău - niciun server nu este implicat, iar aplicația funcționează offline odată încărcată.

**Aplicația nu setează niciun cookie.** Pentru a funcționa, păstrează o cantitate mică de date **doar pe
dispozitivul tău**, niciodată transmisă:

- <!--i:sliders--> **Preferințe de interfață** - temă, limbă, setări de sunet, dimensionarea
  sidebar-ului/zoom-ului, alegeri de sortare și vizualizare, ce sfaturi de onboarding ai văzut deja - în
  `localStorage`, astfel încât să fie disponibile înainte ca aplicația să termine de pornit.
- <!--i:download--> **Un cache offline al catalogului de tool-uri și al previzualizărilor de asset-uri**, astfel încât galeria
  să funcționeze fără conexiune.
- <!--i:hash--> **Contoare locale de utilizare** pentru statisticile din cardul profilului tău (câte exporturi, ce
  tool-uri) - un blob mic și limitat în `localStorage`, niciodată citit de noi, niciodată trimis
  nicăieri.
- <!--i:folder--> **Propriile tale documente, sesiuni salvate, asset-uri încărcate și fonturi** - stocate în
  IndexedDB pe dispozitivul tău, niciodată încărcate, niciodată citite de altcineva decât tine.

Nimic din toate acestea nu este partajat, vândut sau folosit pentru a te identifica sau urmări. Nu
există nimic la care să consimți, pentru că nu are loc nicio colectare - doar această notificare, ca să
știi ce se păstrează și unde. Șterge totul oricând cu **Profil → Șterge toate
datele mele**, sau ștergând stocarea site-ului din browserul tău. (Conform Directivei ePrivacy Art. 5(3), stocarea strict necesară pentru serviciul pe care l-ai cerut
nu necesită consimțământ - doar transparență, ceea ce reprezintă atât acest document, cât și
notificarea din aplicație.)

![Secțiunea de stocare a paginii de profil pe un ecran cu lățime de telefon: fiecare categorie de date de pe dispozitiv, numită, cu butonul Șterge toate datele mele chiar alături](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%2C.store-manages%2C.storage-subsection%2C.store-selbar%2C.store-chip-val%2C%23store-hero-num%2C%23store-headroom%2C%23store-quota%2C%23store-reclaim%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23storage-section&dark=1&filename=pv-storage-clear)

Propria ta copie de rezervă a acestor date - pachetul `lolly-backup` produs de **Exportă
datele mele și randează tot** - este un fișier pe care îl păstrezi și îl controlezi. Nu ajunge niciodată pe
serverele noastre, decât dacă alegi tu să-l trimiți undeva. Vezi [Transfer de
date](/info/data-transfer.html).

## Utilitare pe dispozitiv

Unele tool-uri - **Strip Hidden Data**, **Compress PDF** și altele care poartă
insigna **"Rulează pe dispozitivul tău"** - operează pe un fișier pe care îl furnizezi tu. Fișierul este citit
în memorie în browserul tău, transformat local și oferit înapoi ca descărcare.
Nu este niciodată încărcat, pentru că nu există niciun server pe traseu unde să fie încărcat. Aceste utilitare funcționează offline, iar rezultatul lor nu poartă niciun filigran sau metadate ale
noastre - scopul majorității lor este să elimine și să protejeze date, nu să adauge riscuri.

![Insigna pe care o poartă aceste tool-uri: Rulează pe dispozitivul tău - nimic nu este încărcat](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=.on-device-badge&dark=1&filename=pv-ondevice-badge)

## Când aplicația comunică cu o rețea, în întregime

Tabelul de mai jos este lista completă a tot ce preia sau trimite aplicația printr-o
rețea. Dacă nu e aici, aplicația nu o face.

| Ce | Ce anume iese efectiv de pe dispozitivul tău | Când (acțiunea care declanșează asta) | Dacă un operator blochează asta |
|---|---|---|---|
| Sincronizare catalog de instrumente | Nimic personal - o cerere pentru propriul index public de instrumente și resurse al Lolly, către originea proprie a aplicației | La pornire, apoi stocat în cache offline | Aplicația rulează pe setul de instrumente stocat în cache. Doar descoperirea de instrumente noi se oprește |
| Un instrument care are nevoie de date live | Orice cere acel instrument specific, către gazda numită chiar în descrierea sa. Astăzi este doar căutarea de oraș din instrumentul Meeting Planner, care cere `geocoding-api.open-meteo.com` să transforme un nume de oraș în coordonate și fus orar - fără cont, fără cheie și fără identificator dincolo de cererea în sine. Câmpul de introducere spune asta chiar acolo unde tastezi, iar fiecare răspuns este salvat pe dispozitivul tău, astfel încât un oraș este căutat o singură dată | Doar cât timp folosești acel instrument, și doar după ce introduci o locație | Acea căutare eșuează. Poți totuși introduce coordonatele manual, iar nimic altceva nu este afectat |
| Google Fonts | Numele familiei de fonturi alese și adresa ta IP, către serverele de fonturi Google (`fonts.googleapis.com` pentru foaia de stil, `fonts.gstatic.com` pentru fișierul de font) | Doar dacă adaugi un Google Font în editorul de brand, **și doar după ce accepți asta într-un dialog care spune exact acest lucru** - o preluare unică per familie, apoi rămâne pe dispozitivul tău și este folosit offline | Selectorul Google Fonts eșuează în siguranță (fail closed). Încarcă în schimb un fișier de font |
| Trimite pe Google Drive | Singurul fișier pe care ai ales să-l trimiți, către API-ul Drive al Google (`www.googleapis.com`), după o autentificare Google pe care o finalizezi în propria fereastră pop-up a Google. Accesul Lolly este limitat la fișierele pe care le-a creat (scopul `drive.file` - nu poate citi niciodată restul Drive-ului tău), iar tokenul de autentificare este păstrat în memorie doar pentru sesiune, niciodată stocat | Doar când apeși „Send to Google Drive” la un export EMF, și doar pe build-urile în care operatorul a configurat un id de client Google - fără unul, butonul nu există | Butonul nu apare niciodată. Descarcă fișierul și încarcă-l tu însuți pe Drive |
| Trimite pe Dropbox | Singurul fișier pe care ai ales să-l trimiți, către API-ul Dropbox (`api.dropboxapi.com` pentru autentificare și metadate, `content.dropboxapi.com` pentru fișierul propriu-zis), după o autentificare Dropbox pe care o finalizezi în propria fereastră a Dropbox. Accesul Lolly este limitat la folderul aplicației (poate vedea doar `Apps/` și propriul folder de acolo - niciodată restul Dropbox-ului tău), linkul „Open” pe care ți-l arată este un link privat cu durată scurtă de viață (nu se creează niciun share public), iar un token de reîmprospătare este stocat doar dacă bifezi „stay connected” | Doar când apeși „Send to Dropbox” pe un fișier, și doar pe build-urile în care operatorul a configurat un id de client Dropbox - fără unul, butonul nu există | Butonul nu apare niciodată. Descarcă fișierul și încarcă-l tu însuți pe Dropbox |
| Trimite pe OneDrive | Singurul fișier pe care ai ales să-l trimiți, către serviciile de identitate și Graph ale Microsoft (`login.microsoftonline.com` pentru autentificare, `graph.microsoft.com` pentru încărcare; un fișier mare este încărcat în bucăți către o adresă de încărcare deținută de Microsoft pe `api.onedrive.com`, `*.up.1drv.com` sau `*.sharepoint.com`), după o autentificare Microsoft pe care o finalizezi în propria fereastră a Microsoft. Accesul Lolly este limitat la propriul folder de sub `Apps/` (nu poate citi niciodată restul OneDrive-ului tău), plus numele tău de afișare pentru eticheta contului, iar un token de reîmprospătare este stocat doar dacă bifezi „stay connected” | Doar când apeși „Send to OneDrive” pe un fișier, și doar pe build-urile în care operatorul a configurat un id de client Microsoft - fără unul, butonul nu există | Butonul nu apare niciodată. Descarcă fișierul și încarcă-l tu însuți pe OneDrive |
| Trimite pe LinkedIn | Singurul fișier pe care ai ales să-l trimiți, plus numele său ca text al postării, către LinkedIn (`www.linkedin.com` pentru autentificare, `api.linkedin.com` pentru încărcare și postare), după o autentificare LinkedIn pe care o finalizezi în propriul browser. Postarea ajunge în propriul tău feed, ca postare publică sub numele tău. Lolly poate posta în numele tău și îți poate citi numele pentru eticheta contului, nimic altceva de pe LinkedIn-ul tău, iar autentificarea este păstrată pe acest dispozitiv doar dacă bifezi „stay connected” - tokenurile LinkedIn durează 60 de zile și nu pot fi reînnoite silențios, așa că expiră de la sine | Doar când apeși „Send to LinkedIn” pe un fișier, doar în aplicațiile desktop, și doar pe build-urile în care este configurată o aplicație LinkedIn - fără una, butonul nu există | Nimic de blocat în aplicația web: asta există doar în **aplicațiile desktop**, astfel încât acele două gazde sunt în mod deliberat ABSENTE din Content-Security-Policy de mai jos a aplicației web. În aplicațiile desktop, elimină aplicația LinkedIn configurată și butonul nu mai apare niciodată |
| Profiluri de tipar ICC | Nimic personal - o cerere pentru un profil standard de condiții de tipar, către registrul public ICC (`registry.color.org`, `www.color.org`) | Doar dacă apeși un preset ICC în gestionarul de profiluri de tipar - o preluare unică per profil, apoi rămâne pe dispozitivul tău | Preseturile ICC eșuează. Furnizează în schimb propriul profil `.icc` |
| Radio pe internet | Nimic personal - o cerere de playlist și un flux audio, către stație (`api.somafm.com` și serverul icecast pe care îl numește, `*.somafm.com`) | Doar cât timp redai radioul opțional integrat din playerul audio | Radioul eșuează. Orice altă funcție audio continuă să funcționeze |
| Un URL pe care îi ceri unui instrument să-l capteze | O cerere către exact adresa web pe care o tastezi, din instrumentul de captură de ecran URL. Oricare ar fi acea adresă. Această gazdă nu se regăsește în politica de mai jos, pentru că o alegi chiar în momentul folosirii | Doar când introduci un URL în acel instrument și pornești captura | Un operator nu poate include asta pe lista albă după gazdă. Ca s-o elimini, elimină instrumentul |
| Verificare semnătură SEAL | **Nimic.** Aplicația web nu are deloc un resolver DNS - vezi mai jos | Niciodată | Nimic de blocat |
| Modele AI pe dispozitiv | Nimic personal - o descărcare unică a fișierului de model de la gazda de modele a Lolly (`lolli.li`), apoi stocată în cache pe dispozitivul tău; fără cont, fără identificator, doar cererea și IP-ul tău | Doar când folosești o funcție care are nevoie de un model (scanare profundă Verify, upscale de imagine, voce și altele similare) | Acea funcție așteaptă descărcarea; orice altceva continuă să funcționeze |
| Instanță la distanță | Orice răspunde instanța pe care o numești, prin aceeași sincronizare de catalog descrisă mai sus - plus o etichetă de versiune pe cererile către ea (tipul de shell și versiunea engine-ului, aceeași informație pe care o poartă un user agent), astfel încât operatorul ei poate vedea ce versiuni Lolly sunt în uz. Pe o instanță gestionată, cât timp ești autentificat, acea etichetă mai poartă și un id de instalare per dispozitiv, astfel încât lista de dispozitive a operatorului poate distinge această instalare. Ea călătorește doar pe cereri pe care propria ta folosire le face deja - nu există niciun cronometru și nimic nu „sună acasă” - iar părăsirea instanței șterge id-ul, astfel încât un dispozitiv care se reconectează ulterior prezintă unul nou | Doar dacă îndrepți explicit shell-ul către un alt deployment Lolly | Comutarea de instanță eșuează. Instanța ta locală nu este afectată |

Fiecare gazdă fixă din acel tabel este totodată lista albă completă din Content-Security-Policy a aplicației, pe care browserul o impune. Așadar lista nu este doar o descriere a ceea ce face codul astăzi, ci limita la care browserul ține aplicația: o modificare viitoare care ar încerca să contacteze o altă gazdă ar fi blocată, nu permisă tacit. Un rând este excepția deliberată, și celula sa proprie spune asta: Send to LinkedIn există doar în aplicațiile desktop, așa că politica aplicației web nu numește niciuna dintre cele două gazde ale sale - aplicația web nu le-ar putea atinge nici dacă ar încerca codul ei. Alte două rânduri nu au o gazdă fixă, pentru că tu alegi adresa chiar în momentul folosirii: un URL pe care îi ceri unui instrument să-l capteze, și o instanță la distanță către care îndrepți shell-ul. Niciuna nu se regăsește în politică, și fiecare se întâmplă doar când tastezi o adresă și acționezi pe baza ei. Un deployment care nu vrea niciuna dintre cele opționale (o instanță enterprise cu propriile fonturi, de exemplu) elimină acele gazde din politica sa, iar funcțiile eșuează în siguranță (fail closed) în loc să contacteze exteriorul.

Niciuna dintre acestea nu trimite documentele, proiectele, sesiunile sau fișierele tale încărcate nicăieri.
Ele există pentru a aduce lucruri *către* dispozitivul tău (tool-uri, fonturi, modele), niciodată pentru a trimite
lucruri *de pe* el, cu excepțiile numite explicit în secțiunile de mai jos.

**O notă despre ce am eliminat.** Verify poate verifica semnături SEAL, o schemă în care
cheia de semnare a unui fișier este publicată în DNS. Browserele nu pot face interogări DNS, deci orice
implementare web trebuie să direcționeze căutarea printr-un resolver DNS-over-HTTPS
terț - care i-ar arăta acelui operator domeniul verificat plus adresa ta IP. Foloseam pe cel al Cloudflare. **Nu-l mai folosim, și nu există niciun
înlocuitor**: aplicația web acum nu transmite niciun resolver deloc, deci verificarea SEAL
aici nu face nicio cerere de rețea. Fișierele a căror înregistrare SEAL poartă cheia inline se
verifică în continuare complet offline. Fișierele a căror cheie se află în DNS raportează "niciun resolver de
chei" în schimb, și le poți verifica pe cele în aplicația desktop sau de linie de comandă,
care rezolvă DNS nativ prin propriul tău dispozitiv, fără implicarea niciunui terț.

![Ecranul Verify: o zonă de plasare și nimic altceva - fișierul este verificat exact unde se află deja, fără încărcare și fără cont](/t/url-shot?url=%2F%23%2Fverify&width=1440&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop) Poți confirma singur acest lucru: verificări interogabile prin grep pentru aceasta și fiecare
altă afirmație de pe această pagină, cu comenzile exacte și rezultatul așteptat, se află la
[Verifică singur](/info/verify-yourself.html).

## URL-uri de randare hot-linked

> **Activ pe lolly.tools.** Fiecare
> URL `https://lolly.tools/tool/<tool-id>.<ext>?<inputs>` este randat cu
> adevărat, iar intrările călătoresc în acea adresă URL. Secțiunea de mai jos
> explică ce înseamnă asta pentru tine, iar un operator poate dezactiva
> funcția pe propria instanță.

Aplicația în sine rămâne în întregime pe dispozitivul tău. Separat, un operator poate activa
**URL-uri de randare hot-link** - `/tool/<tool-id>.<ext>?<inputs>` - astfel încât un
link Lolly partajat poate apărea ca imagine live într-un README, un wiki sau un dashboard. Preluarea unuia
îi cere serverului să randeze **date publice de tool și de catalog** cu intrările
scrise în URL.

- <!--i:usercheck--> **Fără conturi, fără cookie-uri, fără stare.** Endpoint-ul este anonim și nimic
  de pe dispozitivul tău nu este citit. Documentele, sesiunile și fișierele tale încărcate nu părăsesc niciodată
  browserul tău - nu pot apărea deloc în aceste linkuri.
- <!--i:document--> **Dar adresa URL în sine este înregistrată.** Șirul de interogare al unei URL face parte din linia
  cererii, așa că apare în jurnalele obișnuite de acces ale platformei de găzduire la fel cum
  o face fiecare cale solicitată. Dacă intrările unui link conțin numele sau e-mailul cuiva -
  o ecuson cu nume, o semnătură de e-mail - **acel text ajunge în acele jurnale**, și nicio
  formulare a politicii nu schimbă asta. De aceea o adresă URL hot-link este locul greșit
  pentru date personale: pune în ea doar ce ai pune pe o pagină publică.
- <!--i:globe--> **Intrările sunt publice prin construcție** oricum - sunt orice a
  scris autorul linkului în adresa URL, lizibil pentru oricine ajunge la link. Nu pune
  informații secrete într-un link partajat. Lolly oferă criptare pentru linkuri cu conținut sensibil.
- <!--i:eyeoff--> Răspunsurile sunt **stocate în cache și limitate ca rată** la fel ca orice imagine publică, și marcate
  `noindex`, astfel încât motoarele de căutare nu îți indexează randările.

Faci self-hosting la Lolly și nu vrei o suprafață publică de randare? Setează
`LOLLY_DISABLE_RENDER_GET=1`, și fiecare
dintre aceste URL-uri returnează 404.

## Serverul MCP (opțional, pentru agenți AI)

Lolly poate fi accesat și de un agent AI prin Model Context Protocol - un
endpoint operat de un operator (lolly.tools rulează unul; oricine își poate face self-host propriu,
inclusiv complet air-gapped). Are aceeași poziție fără conturi ca traseul de randare,
plus trei tool-uri care gestionează inevitabil octeți de fișiere:

- <!--i:cpu--> **`lolly_transform`** (rulează un utilitar de pe dispozitiv pe server, în numele
  agentului apelant), **`lolly_verify`** (verifică Content Credentials) și **`lolly_redact`**
  (înnegrește regiuni ale unei imagini sau ale unui PDF) toate acceptă
  octeții unui fișier de la apelant. Sunt procesate **în proces, în memorie**,
  iar rezultatul este returnat în acel apel - fișierul nu este niciodată scris pe
  disc și niciodată stocat după finalizarea cererii.
- <!--i:checklist--> Orice alt tool - `lolly_render`, `lolly_build_url`, `lolly_list_tools`,
  `lolly_describe_tool` - funcționează doar din parametri (text, numere, culori,
  URL-uri, id-uri de asset-uri din catalog), aceleași intrări pe care le folosește un URL de randare hot-link.
- <!--i:lock--> Accesul este fie un token partajat pe care operatorul îl emite clienților în care are încredere, fie
  OAuth 2.1 fără stare: token-uri semnate cu durată scurtă de viață, verificate față de un secret
  partajat, nimic stocat server-side, iar token-ul în sine nu este niciodată scris într-un
  jurnal sau într-un URL de randare.

## Identitate Content Credentials (o autentificare pe care trebuie s-o pornești singur)

Lolly poate sigila o **Content Credential** criptografică în exporturile tale, astfel încât oricine poate verifica, offline, că un fișier nu a fost modificat de când a părăsit Lolly. Asta e **activată implicit și complet local** - cheia de semnare este generată pe dispozitivul tău, iar semnarea în sine are loc offline. Fără înrolare, cheia respectivă este de unică folosință: o pereche de chei nouă este creată pentru fiecare export și eliminată odată cu acesta. Odată ce te înrolezi, cheia devine una permanentă și este generată **neextractibilă** - nici măcar codul propriu al Lolly nu o poate citi, ci doar îi poate cere să semneze. În ambele cazuri, ea nu părăsește niciodată dispozitivul tău. Această secțiune acoperă singurul pas *opțional* peste asta: înrolarea unei identități verificate, astfel încât exporturile tale să spună "Verificat - semnat de \<your email\>" în loc de o cheie anonimă. **Dacă sari peste înrolare, nimic din această secțiune nu se aplică ție și nicio dată personală nu părăsește vreodată dispozitivul tău.**

![Cardul de identitate verificată de pe pagina de profil, cu lățime de telefon: selectorul de durată de viață a certificatului și pasul de înscriere de dedesubt, inactiv până când îl pornești tu însuți](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=430&height=1600&dpi=192&waitMs=2400&css=.welcome-dialog%2C.personalize-nudge%7Bdisplay%3Anone%7D&format=svg&walker=1&cropSelector=%23identity-section&dark=1&filename=pv-identity-enrol)

Dacă te înscrii, iată exact ce se întâmplă:

1. **Alegi o metodă de autentificare** - GitHub, Google, SUSE (id.suse.com) sau un
   link trimis prin email. Pentru cei trei furnizori OIDC, ești redirecționat către
   pagina proprie de autentificare a acelui furnizor, guvernată de politica lor de confidențialitate, nu de a noastră.
   Serviciul de certificate al Lolly primește înapoi doar o adresă de email verificată și
   numele furnizorului. Pentru link-ul prin email, adresa pe care o tastezi este trimisă către
   **Resend**, un API de email tranzacțional, doar pentru a livra acel unic link.
2. **Un cookie cu durată scurtă protejează redirecționarea.** Acesta este singurul cookie pe care
   întregul sistem Lolly îl setează: `lolly_ca_state`, `HttpOnly`, limitat la `/api/ca`,
   expirând în zece minute. Poartă o valoare aleatorie, nu un identificator de
   urmărire, și există doar pentru a împiedica falsificarea redirecționării OAuth. Este
   șters imediat ce autentificarea se finalizează.
3. **Adresa ta IP este folosită, pe scurt, pentru a preveni abuzul** endpoint-urilor de
   autentificare (astfel încât un script să nu poată spama o căsuță de email sau epuiza cota de email) - păstrată
   doar în memoria serverului, pentru o fereastră glisantă de aproximativ un minut, niciodată scrisă
   într-un jurnal sau persistată nicăieri.
4. **Serviciul de certificate emite un certificat cu durată scurtă** (7, 30, 90 sau 365
   de zile, alegerea ta, limitată de politica operatorului) care leagă emailul tău verificat
   de jumătatea publică a perechii de chei generate pe dispozitivul tău. Jumătatea privată
   nu părăsește niciodată browserul tău.
5. **Nimic despre emitere nu este înregistrat.** Serviciul de certificate nu păstrează niciun jurnal
   de emitere: nici emailul tău, nici furnizorul, niciun număr de serie, nicio
   marcă temporală. Nicio bază de date, nicio linie de jurnal, niciun webhook. Adresa ta de email există în
   cerere doar atât cât să fie scrisă în certificatul pe care propriul tău dispozitiv îl primește, și apoi
   dispare complet de pe partea noastră.
6. **După aceea, semnarea este din nou offline** pentru toată durata de viață a certificatului.
   Exportul unui fișier nu contactează niciodată serviciul de certificate - doar înscrierea a făcut-o.

**Compromisul, spus fără ocolișuri.** O versiune anterioară a acestui serviciu chiar loga fiecare
emitere, astfel încât un certificat emis greșit sau compromis să poată fi urmărit. Am
eliminat asta, pentru că acel jurnal era singurul loc din întregul Lolly unde date
personale ajungeau să stea pe un server, și preferăm să nu le deținem decât să le deținem cu
grijă. Ce pierdem este trasabilitatea server-side: dacă un certificat este
folosit greșit, nu putem căuta cine l-a obținut. Certificatele au durată scurtă prin
design - 7 până la 365 de zile, alegerea ta, limitată de operator - și expiră de la
sine, ceea ce este atenuarea pe care ne bazăm în schimb. Cei care fac self-host și ale căror
obligații proprii cer un jurnal de audit pot adăuga unul, devenind astfel operatorul acelor
date.

## Extensia de browser

Extensia de browser **Lolly URL Screenshot** nu colectează, stochează sau
transmite date personale. Fără analytics, fără urmărire, fără server la distanță.

**Ce face.** Când ceri aplicației web Lolly să facă o captură de ecran a unui URL,
extensia deschide acea pagină într-o filă temporară din fundal, o capturează în browserul tău
folosind DevTools Protocol, predă imaginea înapoi aplicației și închide
fila. Totul se întâmplă local, pe propriul tău dispozitiv și rețea.

**Date.**

- <!--i:shieldcheck--> **Nu colectăm nimic.** Extensia nu are servere și nu face nicio cerere de rețea
  proprie.
- <!--i:photos--> **Imaginile capturate** merg direct la aplicația Lolly din același browser - niciodată
  încărcate de extensie.
- <!--i:link--> **URL-urile pe care le capturezi** sunt folosite doar pentru a încărca acea pagină unică pentru acea unică
  captură de ecran. Nu sunt logate sau partajate.

**Permisiuni.**

- <!--i:wrench--> **`debugger`** - pentru a captura pagina randată prin DevTools Protocol (același
  mecanism folosit de aplicația desktop Lolly).
- <!--i:monitor--> **`tabs`** - pentru a deschide și închide fila temporară în care se încarcă pagina.
- <!--i:globe--> **Acces la host (`<all_urls>`)** - pentru că pagina pe care alegi s-o capturezi poate fi
  pe orice site. Chrome afișează asta la instalare ca un avertisment de permisiune
  largă. Extensia vizitează doar URL-ul pe care i-l dai.

Niciuna dintre acestea nu este folosită pentru a citi, monitoriza sau transmite navigarea ta dincolo de
acea unică captură cerută.

## Jurnale de infrastructură

Ca orice website, serverele din spatele lolly.tools - și din spatele oricărei implementări
Lolly - generează jurnale standard de acces web-server ori de câte ori o cerere ajunge deloc
la ele: adresă IP, cale cerută, marcă temporală, user agent. Acesta este comportament de bază de
găzduire, nu ceva ce adaugă Lolly în plus, și nu conține niciodată
conținutul documentelor tale, pentru că acelea nu ajung niciodată la un server, pentru început. Singura
excepție deliberată este un fișier pe care îl predai explicit unui apel MCP
`lolly_transform`, `lolly_verify` sau `lolly_redact`, care este procesat în memorie și niciodată
scris pe disc sau într-un jurnal, așa cum s-a descris mai sus.

**Propriul cod al Lolly nu scrie nimic în acele jurnale.** Serverul MCP nu conține deloc
instrucțiuni de logging. Serviciul de certificate emite exact două linii, ambele
la eșec și ambele deliberat curățate: un cod de stare de eșec la trimitere fără adresa
destinatarului, și un mesaj de eroare fără stack trace sau URL (un stack ar putea
purta un token de înscriere). Orice altceva din jurnal aparține platformei de găzduire,
nu nouă.

Pentru lolly.tools, găzduirea este Vercel, iar reținerea jurnalelor de acces urmează propriile
setări implicite ale platformei Vercel pentru planul nostru. Nu configurăm niciun drenaj de jurnale, niciun
export de jurnale pe termen lung și niciun produs de analytics sau monitorizare peste asta. Nu păstrăm
nicio copie a acestor jurnale noi înșine, ceea ce înseamnă și că nu avem cum să le căutăm pentru tine - vezi
[Drepturile tale](#your-rights).

## Temeiuri juridice, retenție și destinatari

Aproape nimic de aici nu necesită un temei juridic, pentru că aproape nimic nu este procesat. Pentru
completitudine, lista integrală:

| Procesare | Temei juridic (GDPR Art. 6) | Reținut pentru |
|---|---|---|
| Tot ce se află pe dispozitivul tău (documente, preferințe, cache, contoare) | **Nu este deloc procesare din partea noastră** - nu ajunge niciodată la noi. Stocarea pe dispozitivul tău este strict necesară pentru serviciul solicitat (ePrivacy Art. 5(3)), deci nu necesită consimțământ | Până când îl ștergi |
| Adresa ta de email în timpul înrolării Content Credentials | **Art. 6(1)(b)**, executarea unui serviciu pe care l-ai solicitat explicit | Nu este reținută. Prezentă în memorie doar pe durata solicitării |
| Adresa ta IP pe punctele finale de autentificare, pentru limitarea ratei | **Art. 6(1)(f)**, interesul nostru legitim de a preveni abuzul unui serviciu gratuit și al cotei de email a unei terțe părți. Considerăm că aceasta trece un test de echilibrare deoarece se află doar în memorie, nu este niciodată scrisă și este eliminată în aproximativ un minut | ~1 minut, în memoria serverului, niciodată persistată |
| Jurnale de acces ale găzduirii (IP, cale, marcaj temporal, agent utilizator) | **Art. 6(1)(f)**, interesul nostru legitim în securitatea serviciului, prevenirea abuzului și diagnosticarea defecțiunilor | Setarea implicită a platformei Vercel pentru planul nostru. Nu adăugăm nicio extragere sau export |

**Destinatari.** Categoriile de destinatari sunt: furnizorul nostru de găzduire (Vercel
Inc.) și - doar dacă folosești opțiunea de autentificare prin email - un furnizor
de email tranzacțional (Resend). Dacă te autentifici cu GitHub, Google sau SUSE (id.suse.com), interacționezi
direct cu acel furnizor sub propria lor politică de confidențialitate. Ei ne comunică o adresă de email verificată și nimic altceva. Nu partajăm date personale cu nimeni
altcineva și nu vindem date, nu rulăm publicitate și nu profilăm utilizatori.

**Transferuri în afara SEE.** Vercel și Resend sunt companii din SUA. Calculul funcțiilor
pentru lolly.tools este fixat pe regiunea Frankfurt (`fra1`) a Vercel, astfel încât
procesarea are loc în UE, dar, fiind furnizori cu sediul în SUA, ar putea totuși
accesa date ca operatori din SUA. Aceste transferuri se bazează pe Clauzele Contractuale
Standard ale Comisiei Europene și/sau pe Cadrul UE-SUA privind Confidențialitatea Datelor,
astfel cum sunt prevăzute în acordul de prelucrare a datelor al fiecărui furnizor. Deoarece
datele personale care ajung la oricare dintre furnizori sunt atât de limitate - o adresă de
email transmisă pentru a trimite un mesaj și jurnale de acces obișnuite - expunerea este
corespunzător de mică.

**Luarea automată a deciziilor.** Niciuna. Nu există profilare și nicio decizie automată
care să producă efecte juridice sau similar de semnificative (Art. 22).

## Confidențialitatea copiilor

Lolly nu colectează cu bună știință informații personale de la nimeni, indiferent de vârstă, în
cursul obișnuit al utilizării aplicației - nu există nimic de colectat. Singurul loc unde
informații personale (o adresă de email) sunt vreodată colectate este înrolarea Content Credentials,
descrisă mai sus, care nu este direcționată sau destinată copiilor.

## Drepturile tale

Deoarece aproape tot ce atinge Lolly este stocat doar pe propriul tău dispozitiv, majoritatea
din ceea ce legislația privind protecția datelor numește "drepturile tale" - acces, corectare, ștergere,
portabilitate - sunt lucruri pe care le poți face deja singur, instant, fără să ceri
nimănui: datele tale se află în stocarea browserului tău, într-o formă pe care o poți inspecta,
exporta (**Export my data & render everything**, mai sus) sau șterge (**Profile → Clear all
my data**).

Formal, conform Articolelor 15-22 GDPR ai dreptul de a **accesa** datele tale
personale, de a le **rectifica**, de a le **șterge**, de a **restricționa** sau **te opune**
prelucrării lor (inclusiv opoziția față de orice bazăm pe interese legitime), la
**portabilitatea datelor** și - acolo unde prelucrarea se bazează pe consimțământ - de a-ți
**retrage acel consimțământ în orice moment**, fără a afecta legalitatea a ceea ce
s-a întâmplat înainte de retragere.

Iată poziția onestă privind exercitarea acestora față de noi. Din moment ce nu mai
păstrăm un jurnal de emitere, **nu deținem nicio dată personală despre tine pe care o putem căuta,
corecta, exporta sau șterge.** Dacă ne scrii și ne întrebi ce avem despre tine, răspunsul
adevărat este nimic, și așa vom spune. Singura categorie care există deloc sunt
jurnalele de acces ale găzduirii asociate unei adrese IP, deținute de furnizorul nostru de găzduire
conform setărilor lor implicite de retenție. Nu avem nicio facilitate de a căuta sau șterge selectiv
acele date și îți vom spune asta în loc să pretindem altceva. Tot ce este cu adevărat
*al tău* se află pe dispozitivul tău, unde poți deja citi, exporta
și distruge fără să ceri permisiunea nimănui.

**Ai dreptul de a depune o plângere.** Dacă crezi că am gestionat datele tale
necorespunzător, poți depune o plângere la o autoritate de supraveghere a protecției
datelor - în UE, autoritatea din țara ta de reședință, locul de muncă sau unde
consideri că a avut loc încălcarea (Art. 77). Autoritatea noastră principală de supraveghere este
*Bayerisches Landesamt für Datenschutzaufsicht* (BayLDA) din Ansbach, Germania. Nu trebuie
să ne contactezi mai întâi, deși ne-ar plăcea șansa de a repara problema.

Nu vindem date. Nu avem date de vândut.

## Modificări aduse acestei politici

Data din partea de sus se schimbă ori de câte ori se schimbă acest document. O modificare care
afectează ce părăsește dispozitivul tău sau ce este reținut primește propria linie aici, nu o
modificare tăcută - dacă vrei să vezi ce s-a schimbat, întreabă (mai jos) sau compară cu
[sursa publică](https://github.com/lolly-tools/lolly/commits/main/docs/privacy.md).

## Cine este responsabil și cum ne poți contacta

**Operatorul de date** pentru lolly.tools este:

> SUSE Software Solutions Germany GmbH
> Frankenstraße 146
> 90461 Nürnberg
> Germania

SUSE a numit un **Responsabil cu Protecția Datelor**, contactabil la
[privacy@suse.com](mailto:privacy@suse.com). Folosește acea adresă pentru orice solicitare
formală conform "Drepturile tale" de mai sus.

Pentru orice legat de Lolly în sine - cum funcționează, de ce un lucru este așa cum este sau
o corecție a acestui document - contactează-l pe **Andy Fitzsimon**,
[fitzy@suse.com](mailto:fitzy@suse.com).

Pentru o instanță Lolly auto-găzduită sau enterprise, contactează în schimb operatorul: operatorul
este responsabilul pentru propria sa implementare. SUSE și proiectul open source
Lolly nu dețin date pentru implementările pe care nu le operează.
