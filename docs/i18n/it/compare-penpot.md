# Lolly e Penpot

_Ultima verifica: 28 settembre 2026._

Se il tuo team progetta in Penpot, Lolly lavora al suo fianco: entrambi sono open source ed entrambi leggono gli stessi design token. Questa pagina dice per quale compito serve ciascuno.

## Cosa fa meglio Penpot

[Penpot](https://penpot.app/) offre design di interfacce, componenti, layout flessibili, prototipi interattivi e ispezione per gli sviluppatori, con modifica in tempo reale e cursori live. Offre installazioni ospitate e self-hosted, con [opzioni di installazione Docker e Kubernetes](https://help.penpot.app/technical-guide/getting-started/). Per progettare un'applicazione, Penpot è lo strumento.

## Dove si sovrappongono

I [design token di Penpot](https://help.penpot.app/user-guide/design-systems/design-tokens/) usano il formato DTCG, che Lolly legge a sua volta, quindi colori, tipografia e altri valori di token si spostano tra i due. [Import a design](/info/design-import.html) di Lolly apre un'esportazione `.penpot` come layout modificabile, e **Send to Penpot** in Lolly rimanda un design indietro come archivio `.penpot`. Lolly mantiene anche il [plugin Lolly Export per Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export), che usa l'engine di Lolly per aggiungere sul dispositivo Content Credentials opt-in.

## Come Lolly svolge il compito in comune

La tela Design di Lolly crea risorse modificabili e può trasformare un layout in uno [strumento con regole](/info/create-a-tool.html). Lo stesso strumento esegue il rendering nel browser, nell'app desktop o nella CLI e crea varianti da dati. Lolly standalone esegue il rendering e firma sul dispositivo, senza account né server. Una [collab privata](/info/collaborate.html) mette in coppia due dispositivi direttamente.

## Con un'organizzazione

Lolly Work aggiunge single sign-on, provisioning SCIM, cataloghi e progetti condivisi, ruoli, approvazioni, record di audit, collab di lavoro e rendering sul server. Entrambi i repository sono MPL-2.0 e un'organizzazione può usarli entrambi. [What runs where](/info/compare.html#what-runs-where) mette le due parti a confronto.

Puoi usarli entrambi: Penpot per il design di interfacce e il prototipo, Lolly per i file ripetibili, collegati da token condivisi e design importati.

Penpot è un marchio del suo titolare. Questa pagina descrive dove i due prodotti si sovrappongono e non è affiliata a Penpot.
