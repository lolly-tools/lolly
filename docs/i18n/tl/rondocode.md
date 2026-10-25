# Mga Rondocode song

Ang rondocode song ay musikang isinulat bilang code: mga synth, pattern at mix, tinutugtog habang nagta-type ka. Kayang magpatugtog ng Lolly ng song sa ilalim ng video, at hinahayaan ka ng **Rondocode** utility na sumulat ng isa at i-export bilang audio. Parehong itinatala ang song sa Content Credentials ng file, kaya sinasabi ng musika kung saan ito galing.

## Magpatugtog ng song sa Lolly

Tumatanggap ang asset picker ng song bilang `.rondo` o `.rondo.json` file, o na-paste na `rondocode.com` share link. Ang song ay code na gumagawa ng sarili nitong tunog, kaya tumutugtog ito sa anumang haba na hinihingi ng clip nito. Maaari itong maging **music bed** sa ilalim ng video export o tumugtog sa ambient player ng Neurospicy Mode.

Tumatakbo ang code ng song sa sandbox ng Lolly, walang network at walang access sa mga file mo. Anumang bahagi na hindi kayang patugtugin ng render, tulad ng live na mikropono, o pag-awit na walang voice model, ay nakalista sa mga detalye ng asset.

Mula sa terminal, ang `lolly mix` ay kumukuha ng song bilang buong soundtrack; tingnan ang [CLI rendering](/info/cli-rendering.html).

## Magsulat at mag-export ng song

Buksan ang **Rondocode** mula sa **Utilities** para sumulat ng song sa live editor ng rondocode at marinig ito habang nagta-type ka. I-export ito bilang **WAV**, **MP3**, **M4A**, **Opus** o **FLAC**, bilang ZIP ng mga stem, bilang **MIDI**, o bilang recording ng kasalukuyang tumutugtog. Ang **Export length** ang nagtatakda kung ilang segundo ang tagal ng audio export. Ang mismong song file (`.rondo.json`) ay ang code mo gaya ng pagkakasulat at walang dalang idinagdag.

Ang song ay maaaring umawit ng mga lyrics nito gamit ang `sing()`. Ang pag-awit ay ginagawa sa device mo ng mga na-download na voice model, at ang file na may synthesised na pag-awit ay laging nagdedeklara ng pag-awit bilang AI-generated (tingnan ang [AI features](/info/ai-features.html)).

## Mga song sa credential

Ang video o audio export na nagpapatugtog ng rondocode song ay itinatala ang bawat song sa Content Credentials nito bilang source:

- ang pangalan ng song;
- ang SHA-256 ng `.rondo.json` file nito;
- kung paano ito nire-render: sa sandbox ng Lolly, ang `vm` execution class, kasama ang bersyon at seed ng renderer, at anumang bahagi na hindi kayang patugtugin ng render.

Ang musikang kinompyut mula sa code ng song ay minamarkahang algorithmic media, kaya hindi ito ina-flag ng Verify bilang AI. Bago ka mag-export, inililista ng linya sa ilalim ng **Download** ang mga song na itatala ng credential; pagkatapos ng export, iniuulat ng parehong linya ang nakita ng pagbasa sa naihatid na file. I-untick ang **C2PA Credentials** para iwanan ang record. Ang still na larawan ay walang itinatalang song, dahil wala itong tunog. Ang `lolly mix` at ang [MCP server](/info/mcp.html) ay nagsusulat ng parehong record.

## Mga file mula sa Rondocode utility

Karamihan ng on-device utility ay walang isinusulat na credential, dahil binabago nila ang file na pag-aari mo na. Gumagawa ng bagong audio ang Rondocode, kaya ang bawat audio file na isinusulat nito ay may Content Credentials na nagtatala ng song bilang source nito: ang pangalan nito, ang SHA-256 ng `.rondo.json` file nito at kung saan tumakbo ang code nito. Sakop niyon ang WAV, MP3, M4A, Opus, FLAC, bawat stem sa stems ZIP at recording ng kasalukuyang tumutugtog.

- Ang sariling mga render ng editor ay tumatakbo sa pribadong frame nito (ang `frame` execution class) at itinatala ang bersyon ng editor.
- Ang render na ginawa ng CLI o share link ay tumatakbo sa `vm` class at itinatala ang bersyon at seed ng renderer.
- Sinasabi rin ng WAV ang pareho sa RIFF comment nito.
- Ang musikang kinompyut mula sa code ng song ay algorithmic media at hindi minamarkahang AI.

Kapag umaawit ang song, idinedeklara ng file na AI-generated ang pag-awit na iyon sa machine-readable na anyo. Ang digital source type ng credential ay composite media na gawa gamit ang mga trained model, inililista ng record ang mga inawit na bahagi, at isang C2PA AI disclosure bawat model ang kumikilala sa bawat model na dinaanan ng pag-awit: Supertonic-3 text to speech, ang wav2vec 2.0 phoneme aligner, ang ContentVec encoder at ang RVC voice, kasama ang repository at commit na pinagho-hostan ng Lolly dito. Ang file na may synthesised na pag-awit ay hindi kailanman sine-save nang walang deklarasyong iyon.

Ang MIDI file ay walang lugar para sa credential, kaya ang text event sa file ang nagdadala ng pahayag sa halip, at sinasabi ito ng export panel. Inilalarawan ng panel ang lahat ng ito bago ka mag-export, at pagkatapos ng bawat export, binabasa ng editor pabalik ang naka-save na file at iniuulat lang ang nakita ng pagbasang iyon.

Para sa kung ano ang itinatala ng Content Credentials sa pangkalahatan, tingnan ang [Mag-export ng file](/info/exporting.html#content-credentials-c2pa).
