# Morceaux Lolly Rondocode

<a id="rondocode-songs"></a>

Un morceau rondocode est de la musique écrite sous forme de code : des synthés, des motifs et un mix, joués pendant que tu tapes. Lolly peut jouer un morceau sous une vidéo, et l'utilitaire **Rondocode** écrit des morceaux et les exporte en audio ; les deux consignent le morceau dans les Content Credentials du fichier.

<!--i:eti-music-->
## Jouer un morceau dans Lolly

Le sélecteur de ressources accepte un morceau sous forme de fichier `.rondo` ou `.rondo.json`, ou de lien de partage `rondocode.com` collé. Un morceau joue pendant toute la durée demandée par son clip. Il peut servir de **fond musical** à un export vidéo ou jouer dans le lecteur d'ambiance de Neurospicy Mode.

Le code du morceau s'exécute dans le bac à sable de Lolly, sans réseau ni accès à tes fichiers. Toute partie qu'un rendu ne peut pas jouer, comme un microphone en direct ou du chant sans les modèles vocaux, est listée dans les détails de la ressource.

Depuis le terminal, `lolly mix` utilise un morceau comme bande-son complète ; voir [Rendu en CLI](/info/cli-rendering.html).

<!--i:eti-code-->
## Écrire et exporter un morceau

Ouvre l'outil **Rondocode** depuis **Utilities** pour écrire un morceau dans l'éditeur en direct de rondocode et l'entendre pendant que tu tapes. Exporte-le en **WAV**, **MP3**, **M4A**, **Opus** ou **FLAC**, en ZIP de pistes séparées, en **MIDI** ou comme enregistrement de ce qui joue. Depuis le terminal, `lolly rondocode --export=mid` écrit le même fichier MIDI. **Export length** définit la durée en secondes d'un export audio. Le fichier du morceau (`.rondo.json`) contient ton code tel que tu l'as écrit, sans aucun ajout.

Un morceau peut chanter ses paroles avec `sing()`. Les modèles vocaux téléchargés produisent le chant sur ton appareil. Un fichier contenant du chant synthétisé déclare toujours ce chant comme généré par IA (voir [Fonctions d'IA](/info/ai-features.html)).

<!--i:eti-badge-check-->
## Les morceaux dans l'attestation

Un export vidéo ou audio qui joue un morceau rondocode consigne chaque morceau comme source dans ses Content Credentials :

- le nom du morceau ;
- le SHA-256 de son fichier `.rondo.json` ;
- son mode de rendu : dans le bac à sable de Lolly, la classe d'exécution `vm`, avec la version et la graine du moteur de rendu, ainsi que toute partie que le rendu n'a pas pu jouer.

La musique calculée à partir du code d'un morceau est marquée comme média algorithmique, donc Lolly Verify ne la signale pas comme de l'IA. Avant l'export, une ligne sous **Download** liste les morceaux que l'attestation consignera. Après l'export, la même ligne indique ce qu'a trouvé la lecture du fichier livré. Décoche **C2PA Credentials** pour omettre l'enregistrement. Une image fixe ne consigne aucun morceau, car elle n'a pas de son. Une image fixe ne consigne aucun morceau. `lolly mix` et le [serveur MCP](/info/mcp.html) écrivent le même enregistrement.

<!--i:eti-file-->
## Fichiers de l'utilitaire Rondocode

La plupart des utilitaires sur l'appareil n'écrivent aucune attestation, car ils transforment un fichier qui t'appartient déjà. Lolly Rondocode crée de nouveaux fichiers audio, donc chaque fichier audio qu'il écrit porte des Content Credentials qui consignent le morceau comme source : WAV, MP3, M4A, Opus, FLAC, chaque piste d'un ZIP de pistes séparées et un enregistrement de ce qui joue.

- Les rendus propres à l'éditeur s'exécutent dans son cadre privé (la classe d'exécution `frame`) et consignent la version de l'éditeur.
- Un rendu créé par la CLI ou un lien de partage s'exécute dans la classe `vm` et consigne la version et la graine du moteur de rendu.
- Un WAV indique aussi la même chose dans son commentaire RIFF.

Quand un morceau chante, la déclaration d'IA est lisible par machine. Le type de source numérique de l'attestation est un média composite créé avec des modèles entraînés, l'enregistrement liste les parties chantées et une déclaration d'IA C2PA par modèle identifie chaque modèle par lequel le chant est passé : la synthèse vocale Supertonic-3, l'aligneur de phonèmes wav2vec 2.0, l'encodeur ContentVec et la voix RVC, avec le dépôt et le commit à partir desquels Lolly l'héberge.

### Ce que contient le fichier MIDI

Le fichier MIDI est un Standard MIDI File, format 1. La première piste contient le tempo et une signature rythmique de 4/4, suivie d'une piste par synthé, portant le nom du synthé. Chaque note garde son début, sa durée et sa vélocité. Un synthé dont le nom désigne un instrument, comme une basse, des cordes, une nappe ou un piano, reçoit l'instrument General MIDI correspondant, et un nom évoquant des percussions est placé sur le canal 10. Un accordage qui ne repose pas sur douze sons est arrondi au demi-ton le plus proche avec un pitch bend.

Un fichier MIDI ne peut pas contenir les réglages de synthé, les filtres, les effets, les bus, les échantillons ou le chant, donc une DAW joue les notes avec ses propres instruments. Le tempo est lu à partir des cycles par seconde du morceau, avec un cycle comme mesure de quatre temps, car la signature rythmique du morceau ne fait pas partie de ce que renvoie le moteur de rendu.

Un fichier MIDI n'a pas de place pour une attestation, donc un événement texte dans le fichier contient la déclaration, et le panneau d'export te l'indique. Le panneau décrit tout cela avant l'export. Après chaque export, l'éditeur relit le fichier enregistré et ne rapporte que ce que cette lecture a trouvé.

Pour savoir ce que les Content Credentials consignent en général, voir [Exporter un fichier](/info/exporting.html#content-credentials-c2pa).
