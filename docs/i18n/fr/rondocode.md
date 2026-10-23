# Chansons Rondocode

Une chanson rondocode est de la musique écrite sous forme de code : synthétiseurs, motifs et mixage, jouée pendant que tu tapes. Lolly peut jouer une chanson sous une vidéo, et l'utilitaire **Rondocode** te permet d'en écrire une et de l'exporter en audio. Les deux consignent la chanson dans les Content Credentials du fichier, pour que la musique dise d'où elle vient.

## Jouer une chanson dans Lolly

Le sélecteur de ressources accepte une chanson sous forme de fichier `.rondo` ou `.rondo.json`, ou de lien de partage `rondocode.com` collé. Une chanson est du code qui produit son propre son, donc elle se joue pendant la durée que demande son clip. Elle peut être le **music bed** sous un export vidéo ou jouer dans le lecteur d'ambiance de Neurospicy Mode.

Le code de la chanson s'exécute dans le bac à sable de Lolly, sans réseau et sans accès à tes fichiers. Toute partie qu'un rendu ne peut pas jouer, comme un microphone en direct, ou un chant sans les modèles de voix, est listée dans les détails de la ressource.

Depuis le terminal, `lolly mix` prend une chanson comme bande-son entière ; voir [CLI rendering](/info/cli-rendering.html).

## Écrire et exporter une chanson

Ouvre **Rondocode** depuis **Utilities** pour écrire une chanson dans l'éditeur en direct de rondocode et l'entendre pendant que tu tapes. Exporte-la en **WAV**, **MP3**, **M4A**, **Opus** ou **FLAC**, en ZIP de pistes séparées, en **MIDI**, ou en enregistrement de ce qui joue. **Export length** fixe le nombre de secondes d'un export audio. Le fichier de chanson lui-même (`.rondo.json`) est ton code tel qu'il est écrit et ne porte rien d'ajouté.

Une chanson peut chanter ses paroles avec `sing()`. Le chant est produit sur ton appareil par des modèles de voix téléchargés, et un fichier qui contient un chant synthétisé déclare toujours ce chant comme généré par IA (voir [AI features](/info/ai-features.html)).

## Les chansons dans le credential

Un export vidéo ou audio qui joue une chanson rondocode consigne chaque chanson dans ses Content Credentials comme source :

- le nom de la chanson ;
- le SHA-256 de son fichier `.rondo.json` ;
- la façon dont elle a été rendue : dans le bac à sable de Lolly, la classe d'exécution `vm`, avec la version et la graine du moteur de rendu, et toute partie que le rendu n'a pas pu jouer.

La musique calculée à partir du code d'une chanson est marquée comme média algorithmique, donc Verify ne la signale pas comme IA. Avant d'exporter, une ligne sous **Download** liste les chansons que le credential consignera ; après l'export, la même ligne rend compte de ce qu'a trouvé une relecture du fichier livré. Décoche **C2PA Credentials** pour omettre l'enregistrement. Une image fixe ne consigne aucune chanson, car elle ne porte aucun son. `lolly mix` et le [serveur MCP](/info/mcp.html) écrivent le même enregistrement.

## Les fichiers de l'utilitaire Rondocode

La plupart des utilitaires sur l'appareil n'écrivent aucun credential, car ils transforment un fichier que tu possèdes déjà. Rondocode crée de l'audio nouveau, donc chaque fichier audio qu'il écrit porte des Content Credentials qui consignent la chanson comme source : son nom, le SHA-256 de son fichier `.rondo.json` et l'endroit où son code s'est exécuté. Cela couvre WAV, MP3, M4A, Opus, FLAC, chaque piste d'un ZIP de pistes séparées et un enregistrement de ce qui joue.

- Les rendus propres de l'éditeur s'exécutent dans son cadre privé (la classe d'exécution `frame`) et consignent la version de l'éditeur.
- Un rendu fait par la CLI ou un lien de partage s'exécute dans la classe `vm` et consigne la version et la graine du moteur de rendu.
- Un WAV indique aussi la même chose dans son commentaire RIFF.
- La musique calculée à partir du code de la chanson est un média algorithmique et n'est pas marquée comme IA.

Quand une chanson chante, le fichier déclare ce chant comme généré par IA sous une forme lisible par machine. Le type de source numérique du credential est un média composite réalisé avec des modèles entraînés, l'enregistrement liste les parties chantées, et une déclaration IA C2PA par modèle identifie chaque modèle par lequel le chant est passé : la synthèse vocale Supertonic-3, l'aligneur de phonèmes wav2vec 2.0, l'encodeur ContentVec et la voix RVC, avec le dépôt et le commit d'où Lolly l'héberge. Un fichier contenant un chant synthétisé n'est jamais enregistré sans cette déclaration.

Un fichier MIDI n'a pas de place pour un credential, donc un événement texte dans le fichier porte la déclaration à la place, et le panneau d'export te le dit. Le panneau décrit tout cela avant que tu exportes, et après chaque export l'éditeur relit le fichier enregistré et ne rend compte que de ce que cette lecture a trouvé.

Pour ce que les Content Credentials consignent en général, voir [Export a file](/info/exporting.html#content-credentials-c2pa).
