# Folosește Lolly în organizația ta

Organizația ta poate rula propriul Lolly: aceeași aplicație, cu instrumentele și sistemele de design pe care le-a ales. Află cum să o accesezi, să te autentifici și ce se schimbă.

Pentru planificarea configurării organizației, [Folosește Lolly cu DAM-ul existent](/info/use-with-dam.html) explică modul în care o bibliotecă aprobată poate rămâne la locul ei în timp ce oamenii creează conținut în Lolly. [Suveranitatea conținutului](/info/content-sovereignty.html) descrie controlul mai larg asupra creării, guvernanței, stocării și portabilității.

::: note De ce ai nevoie de la organizația ta
Adresa web a instanței sale Lolly sau un fișier de configurare `.lolly` creat de organizația ta. lolly.tools nu se conectează de la sine la o organizație.
:::

<!--i:eti-globe-->
## Într-un browser

Deschide adresa primită de la organizația ta. Dacă pagina îți cere să te autentifici, apasă **Sign in** și urmează pagina de autentificare care se deschide. După aceea, Lolly funcționează ca de obicei, cu instrumentele și sistemele de design ale organizației tale.

Poți începe și din lolly.tools: deschide vizualizarea **Settings**, iar pe cardul **Lolly instance** apasă **Open a workspace**, introdu adresa și apasă **Open this instance**. Browserul merge la adresa proprie a organizației tale, deoarece un browser nu poate încărca instrumentele altei instanțe Lolly din lolly.tools.

![Cardul Lolly instance din Settings, unde deschizi spațiul de lucru al organizației tale sau schimbi sursa instrumentelor aplicației](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

<!--i:eti-monitor-->
## În aplicația pentru desktop sau mobil

Aplicația pornește cu instrumentele incluse. Ca să te conectezi, deschide vizualizarea **Settings** și apasă **Change** pe cardul **Lolly instance**. Panoul întreabă **Where should Lolly get its tools?**

1. Alege **Connect to a Lolly instance**.
2. Introdu adresa web a organizației tale și apasă **Check & connect**.
3. Apasă **Use this instance**. Ecranul următor, **Import your data (optional)**, aduce munca salvată dintr-o copie de siguranță Lolly. Apasă **Skip** dacă nu ai una.
4. Autentifică-te dacă aplicația îți cere.

Instrumentele unei instanțe conectate rulează cu același nivel de încredere ca cele proprii ale aplicației, așa că conectează-te doar la o instanță în care ai încredere. Organizația ta îți poate trimite în schimb un fișier de configurare `.lolly` care conectează aplicația pentru tine.

Ca să schimbi instanța mai târziu, folosește din nou **Change** sau **Leave** pe același card.

### Autentificare cu un cod

În aplicațiile pentru desktop și mobil, ecranul de autentificare oferă și un cod scurt când instanța Lolly a organizației tale acceptă autentificarea prin cod. Apasă **Open sign-in in browser**, autentifică-te și aprobă codul acolo. Sau deschide adresa afișată pe ecran pe un telefon sau computer pe care ești deja autentificat și introdu codul. Codul este valabil aproximativ zece minute.

<!--i:eti-sliders-->
## Ce este diferit acolo

- **Unele controale sunt setate pentru tine.** Un control gestionat de organizația ta afișează **Managed by** și numele organizației sau **Managed by your organisation**. Un control fixat nu poate fi schimbat, iar un meniu poate oferi doar unele dintre opțiunile sale. Unele controale sunt ascunse. Consola organizației tale înregistrează ce regulă a fixat un control și de ce. Întreabă persoana care administrează instanța Lolly a organizației tale.
- **Unele sisteme de design sunt blocate.** Un sistem de design furnizat de organizația ta afișează un lacăt și rămâne doar pentru citire. Ca să încerci modificări, creează o copie editabilă în **Settings → Preferences → Design systems**.
- **Sunt listate doar instrumentele ei.** Un instrument pe care organizația ta nu îl oferă nu este afișat.
- **Proiecte partajate.** Dacă organizația ta partajează proiecte cu tine, **Projects** afișează un card **Team projects**. Aceste sesiuni se află pe serverul organizației. Deschide una ca să lucrezi la ea sau pornește o [colaborare de serviciu](/info/collaborate.html#collabs-through-lolly-work-optional) din **Share**, când este disponibilă.
- **Unele exporturi pot necesita aprobare.** Acolo unde organizația ta cere aprobare, **Request approval** înlocuiește **Download**, iar un instrument poate oferi mai puține formate.
- **Ecranul principal se poate deschide cu șabloane.** Dacă organizația ta îți publică șabloane, așa cum ar putea face pentru o companie parteneră, ecranul principal se deschide cu ele în locul mesajului de întâmpinare de la prima vizită. Fiecare șablon este un card, cu **Your copy** ca să continui și **New version** când șablonul se schimbă. Vezi [Șabloane pentru parteneri](/info/work-partner-templates.html).

### Ce rămâne unde

::: cols
## Pe acest dispozitiv

- Propriile salvări, dacă nu activezi [Sync](/info/sync.html)
- Sistemele de design pe care le-ai creat
- Tot ce creezi și descarci

## Pe serverul organizației tale

- Identitatea ta de autentificare și informațiile despre dispozitiv
- Proiecte de echipă, sesiuni partajate și editări live într-o colaborare de serviciu
- Resursele pe care le încarci în biblioteca partajată
- Cereri de aprobare și livrări aprobate
- Un jurnal al autentificărilor tale și al acțiunilor tale de acolo
:::

Când ai un spațiu de lucru conectat, rândul despre confidențialitate de pe primul ecran al aplicației spune același lucru. Aplicațiile proprii Lolly nu trimit spațiului de lucru niciun eveniment de utilizare. [Confidențialitate](/info/privacy.html#organisation-services-with-lolly-work) listează ce stochează serverul și cine controlează acele date.

<!--i:eti-building-->
## Ce adaugă Lolly Work

Serverul organizației tale rulează **Lolly Work**, software-ul pentru organizații al aceluiași proiect open-source. Aplicația nu are nevoie nici de cont de serviciu, nici de Lolly Work când o folosești pe cont propriu.

::: details Ce poate adăuga Lolly Work
Organizația ta găzduiește [Lolly Work](https://github.com/lolly-tools/lolly-work) alături de Lolly și alege ce funcții activează:

- **Autentificare și acces.** Autentificare unică a organizației, permisiuni bazate pe grupuri și câmpuri de profil gestionate. Administratorii pot crea și dezactiva conturi prin SCIM.
- **Muncă partajată.** Proiecte de echipă, sesiuni partajate și [colaborări de serviciu](/info/collaborate.html#collabs-through-lolly-work-optional), cu editare live prin serverul organizației.
- **O bibliotecă de resurse partajată.** Resurse încărcate, colecții și biblioteci conectate, cu reguli de acces, versiuni și revizuire.
- **Revizuire și livrare.** Pași de aprobare, linkuri gestionate cu expirare sau revocare și livrare către destinațiile permise de organizație.
- **Administrare.** O înregistrare de audit a acțiunilor guvernate și raportarea utilizării conform politicii de telemetrie a instanței pentru clienții care trimit evenimente de utilizare. Aplicațiile proprii Lolly nu trimit niciunul în prezent.
:::

Ca să configurezi serviciul, începe cu [Implementare](/info/deployment.html#organisation-services-with-lolly-work). Demonstrația publică de la [lolly.work](https://lolly.work) este un mediu de testare. Folosește adresa proprie a organizației tale pentru munca pe care trebuie să o păstrezi.

<!--i:eti-palette-->
## Brandul altei organizații

Un partener, client sau sponsor îți poate trimite brandul său ca fișier de sistem de design (`.lolly`) în locul unei adrese. Deschiderea acelui fișier nu conectează aplicația la nimic. Fișierul adaugă sistemul său de design lângă al tău pe acest dispozitiv. Un fișier de configurare de la propria organizație conectează aplicația la instanța Lolly a organizației. Înainte să se schimbe ceva, previzualizarea arată ce va face deschiderea unui fișier. [Lucrul cu partenerii](/info/partners.html) acoperă ambele perspective ale lucrului cu brandul altei organizații.

<!--i:eti-unlink-->
## Deconectare

**Leave**, pe cardul **Lolly instance** din **Settings**, elimină sistemul de design, instrumentele și catalogul organizației tale. Munca ta rămâne. Tot ce ai creat cu instrumentele ei nu se va mai deschide până când te reconectezi. Acolo unde instanța Lolly a organizației tale oferă opțiunea, **Sign out everywhere** de pe același card încheie sesiunile tale pe fiecare dispozitiv, inclusiv acesta.

Tot ce ai salvat în organizație rămâne la organizație, conform politicilor sale de acces și păstrare. Deconectarea sau ștergerea datelor de pe acest dispozitiv nu șterge copia de pe server. Într-un browser deschis la adresa proprie a organizației tale nu ai de unde să te deconectezi: deschide în schimb o altă adresă.

<!--i:eti-help-->
## Pe cine să întrebi

Ce ajunge pe serverul organizației tale, cine îi poate vedea proiectele partajate și ce setări sunt fixate sunt deciziile organizației tale. Întreabă persoana care administrează instanța Lolly a organizației tale. [Confidențialitate](/info/privacy.html) explică ce face Lolly în sine cu datele tale.
