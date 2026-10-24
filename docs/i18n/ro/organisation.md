# Folosește Lolly în organizația ta

Organizația ta poate rula propriul Lolly: aceeași aplicație, cu instrumentele și sistemele de design alese de ea. Această pagină arată cum ajungi la el, cum te autentifici și ce se schimbă după aceea.

::: note Ce ai nevoie de la organizația ta
Adresa web a Lolly-ului ei, sau un fișier de configurare `.lolly` făcut de organizația ta. lolly.tools de unul singur nu se conectează la o organizație.
:::

## Într-un browser

Deschide adresa dată de organizația ta. Dacă pagina îți cere să te autentifici, apasă **Sign in** și urmează pagina de autentificare pe care o deschide. După aceea funcționează ca orice Lolly, cu instrumentele și sistemele de design ale organizației tale.

Poți porni și de la lolly.tools: deschide **Settings**, iar pe cardul **Lolly instance** apasă **Open a workspace**, introdu adresa și apasă **Open this instance**. Browserul merge la adresa proprie a organizației tale, pentru că un browser nu poate încărca instrumentele altui Lolly de pe lolly.tools.

![Cardul Lolly instance din Settings, unde deschizi spațiul de lucru al organizației tale sau schimbi de unde ia aplicația instrumentele](/t/url-shot?url=%2F%23%2Fsettings%3Ffocus%3Dinstance-section&width=1440&height=1400&dpi=192&waitMs=2000&format=svg&cropSelector=%23instance-section&walker=1&dark=1&filename=org-instance-card)

## În aplicația desktop sau mobilă

Aplicația pornește cu instrumentele ei incluse. Ca să te conectezi, deschide **Settings** și apasă **Change** pe cardul **Lolly instance**. Foaia întreabă **Where should Lolly get its tools?**

1. Alege **Conectează-te la o instanță Lolly**.
2. Introdu adresa web a organizației tale și apasă **Verifică și conectează-te**.
3. Apasă **Folosește această instanță**. Ecranul următor, **Importă-ți datele (opțional)**, aduce lucrări salvate dintr-o copie de rezervă Lolly; apasă **Omite** dacă nu ai niciuna.
4. Autentifică-te dacă aplicația cere asta.

Instrumentele dintr-o instanță conectată rulează cu aceeași încredere ca ale aplicației înseși, așa că conectează-te doar la una în care ai încredere. Organizația ta îți poate trimite în schimb un fișier de configurare `.lolly` care conectează aplicația pentru tine.

Ca să comuți mai târziu, folosește din nou **Change** sau **Leave** pe același card.

### Autentificare cu un cod

În aplicațiile desktop și mobile, ecranul de autentificare oferă și un cod scurt, când Lolly-ul organizației tale acceptă autentificarea cu cod. Apasă **Open sign-in in browser**, autentifică-te și aprobă codul acolo. Sau deschide adresa afișată pe un telefon sau computer unde ești deja autentificat și introdu codul. Codul durează aproximativ zece minute.

## Ce e diferit acolo

- **Unele controale sunt setate pentru tine.** Un control guvernat de organizația ta arată **Managed by** și numele organizației sau **Managed by your organisation**. Un control fix nu poate fi schimbat, un meniu poate oferi doar o parte din alegeri, iar o linie care începe cu **Set by** poate spune ce regulă se aplică și de ce. Unele controale nu sunt afișate deloc.
- **Unele sisteme de design sunt blocate.** Un sistem de design furnizat de organizația ta arată un lacăt și rămâne doar pentru citire. Ca să încerci modificări, fă o copie editabilă în **Settings → Preferences → Design systems**.
- **Sunt listate doar instrumentele ei.** Un instrument pe care organizația ta nu îl oferă nu este afișat deloc.
- **Proiecte comune.** Dacă organizația ta partajează proiecte cu tine, **Projects** arată o tilă **Team projects**. Aceste sesiuni trăiesc pe serverul organizației. Deschide una ca să lucrezi la ea sau pornește un [work collab](/info/collaborate.html#work-collabs-with-lolly-work-optional) din **Share** când este disponibil.
- **Unele exporturi pot necesita aprobare.** Unde organizația ta cere aprobare, **Request approval** ia locul lui **Download**, iar un instrument poate oferi mai puține formate.

### Ce rămâne unde

::: cols
## Pe acest dispozitiv

- Salvările tale, dacă nu activezi [Sync](/info/sync.html)
- Sistemele de design făcute de tine
- Tot ce creezi și descarci

## Pe serverul organizației tale

- Identitatea ta de autentificare și informațiile despre dispozitiv
- Proiecte de echipă, sesiuni comune și editări live într-un work collab
- Resursele încărcate în biblioteca comună
- Cererile de aprobare și livrările aprobate
- Evenimentele de utilizare, unde organizația ta le activează
:::

[Confidențialitate](/info/privacy.html#organisation-services-with-lolly-work) listează ce stochează serverul și cine controlează acele date.

## Ce adaugă Lolly Work

Serverul organizației tale rulează **Lolly Work**, software-ul pentru organizații al aceluiași proiect open source. Aplicația nu are nevoie nici de cont Work, nici de Lolly Work când o folosești singur.

::: details Ce poate adăuga Lolly Work
Organizația ta găzduiește [Lolly Work](https://github.com/lolly-tools/lolly-work) alături de Lolly și alege ce funcții activează:

- **Autentificare și acces.** Single sign-on al organizației, permisiuni bazate pe grupuri și câmpuri de profil administrate. Administratorii pot proviziona și dezactiva conturi prin SCIM.
- **Muncă comună.** Proiecte de echipă, sesiuni comune și [work collab-uri](/info/collaborate.html#work-collabs-with-lolly-work-optional), cu editare live prin serverul organizației.
- **O bibliotecă comună de resurse.** Resurse încărcate, colecții și biblioteci conectate, cu reguli de acces, versiuni și revizuire.
- **Revizuire și livrare.** Pași de aprobare, linkuri administrate cu expirare sau revocare și livrare către destinațiile permise de organizație.
- **Administrare.** Raportarea utilizării sub politica de telemetrie a instanței, plus o înregistrare de audit a acțiunilor guvernate.

Dacă configurezi serviciul, începe cu [Instalare](/info/deployment.html#organisation-services-with-lolly-work). Demo-ul public de la [lolly.work](https://lolly.work) este un sandbox; folosește adresa proprie a organizației tale pentru munca pe care trebuie să o păstrezi.
:::

## Părăsirea

**Leave**, pe cardul **Lolly instance** din **Settings**, elimină sistemul de design, instrumentele și catalogul organizației tale. Munca ta rămâne. Tot ce ai făcut cu instrumentele ei nu se va mai deschide până te reconectezi.

Tot ce ai salvat în organizație rămâne la organizație, sub politicile ei de acces și păstrare. Plecarea sau ștergerea acestui dispozitiv nu șterge acea copie de pe server. Într-un browser la adresa proprie a organizației tale nu ai ce părăsi: deschide în schimb o altă adresă.

## Pe cine să întrebi

Ce ajunge la serverul organizației tale, cine îi poate vedea proiectele partajate și ce setări sunt fixe sunt deciziile organizației tale. Întreabă pe oricine administrează Lolly-ul organizației tale. [Confidențialitate](/info/privacy.html) acoperă ce face Lolly însuși cu datele tale.
