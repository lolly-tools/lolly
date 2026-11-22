# Mga kanta ng Lolly Rondocode

<a id="rondocode-songs"></a>

Ang rondocode song ay musikang isinulat bilang code: mga synth, pattern at mix, na tumutugtog habang nagta-type ka. Puwedeng magpatugtog ang Lolly ng kanta sa ilalim ng video, at nagsusulat ng mga kanta ang **Rondocode** utility at ine-export ang mga ito bilang audio; pareho nilang itinatala ang kanta sa Content Credentials ng file.

<!--i:eti-music-->
## Magpatugtog ng kanta sa Lolly

Tumatanggap ang asset picker ng kanta bilang `.rondo` o `.rondo.json` file, o bilang naka-paste na `rondocode.com` share link. Tumutugtog ang kanta sa anumang haba na hinihiling ng clip nito. Puwede itong maging **music bed** sa ilalim ng video export o tumugtog sa ambient player ng Neurospicy Mode.

Tumatakbo ang code ng kanta sa sandbox ng Lolly, nang walang network at walang access sa mga file mo. Anumang bahaging hindi kayang patugtugin ng render, tulad ng live na mikropono, o pagkanta nang walang mga voice model, ay nakalista sa mga detalye ng asset.

Mula sa terminal, tumatanggap ang `lolly mix` ng kanta bilang buong soundtrack; tingnan ang [Pag-render sa CLI](/info/cli-rendering.html).

<!--i:eti-code-->
## Sumulat at mag-export ng kanta

Buksan ang **Rondocode** tool mula sa **Utilities** para sumulat ng kanta sa live editor ng rondocode at marinig ito habang nagta-type ka. I-export ito bilang **WAV**, **MP3**, **M4A**, **Opus** o **FLAC**, bilang ZIP ng mga stem, bilang **MIDI** o bilang recording ng kasalukuyang tumutugtog. Mula sa terminal, isinusulat ng `lolly rondocode --export=mid` ang parehong MIDI file. Itinatakda ng **Export length** kung ilang segundo tatagal ang audio export. Ang song file (`.rondo.json`) ay ang code mo ayon sa pagkakasulat, na walang idinagdag.

Puwedeng kantahin ng kanta ang mga lyrics nito gamit ang `sing()`. Ginagawa ng mga na-download na voice model ang pagkanta sa device mo. Laging idinedeklara ng file na may synthesised na pagkanta ang pagkanta bilang gawa ng AI (tingnan ang [Mga AI feature](/info/ai-features.html)).

<!--i:eti-badge-check-->
## Mga kanta sa credential

Itinatala ng video o audio export na nagpapatugtog ng rondocode song ang bawat kanta sa Content Credentials nito bilang source:

- ang pangalan ng kanta;
- ang SHA-256 ng `.rondo.json` file nito;
- kung paano ito ni-render: sa sandbox ng Lolly, ang `vm` execution class, kasama ang bersyon at seed ng renderer, at anumang bahaging hindi napatugtog ng render.

Minamarkahan bilang algorithmic media ang musikang kinalkula mula sa code ng kanta, kaya hindi ito minamarkahan ng Lolly Verify bilang AI. Bago ka mag-export, inililista ng linya sa ilalim ng **Download** ang mga kantang itatala ng credential. Pagkatapos ng export, iniuulat ng parehong linya kung ano ang nakita sa pagbasa sa naihatid na file. Alisin ang tsek sa **C2PA Credentials** para hindi isama ang record. Walang itinatala na kanta ang still image, dahil wala itong tunog. Walang itinatala na kanta ang still image. Isinusulat ng `lolly mix` at ng [MCP server](/info/mcp.html) ang parehong record.

<!--i:eti-file-->
## Mga file mula sa Rondocode utility

Walang isinusulat na credential ang karamihan sa mga utility sa device, dahil binabago nila ang file na pag-aari mo na. Gumagawa ng bagong audio ang Lolly Rondocode, kaya bawat audio file na isinusulat nito ay may Content Credentials na nagtatala ng kanta bilang source nito: WAV, MP3, M4A, Opus, FLAC, bawat stem sa stems ZIP at recording ng kasalukuyang tumutugtog.

- Tumatakbo ang sariling mga render ng editor sa pribadong frame nito (ang `frame` execution class) at itinatala ang bersyon ng editor.
- Ang render na ginawa ng CLI o share link ay tumatakbo sa `vm` class at itinatala ang bersyon at seed ng renderer.
- Isinasaad din ng WAV ang pareho sa RIFF comment nito.

Kapag kumakanta ang kanta, nababasa ng makina ang AI declaration. Ang digital source type ng credential ay composite media na ginawa gamit ang mga sinanay na model, inililista ng record ang mga kinantang bahagi, at tinutukoy ng isang C2PA AI disclosure bawat model ang bawat model na dinaanan ng pagkanta: Supertonic-3 text to speech, ang wav2vec 2.0 phoneme aligner, ang ContentVec encoder at ang RVC voice, kasama ang repository at commit na pinaghanguan ng Lolly para i-host ito.

### Ano ang laman ng MIDI file

Ang MIDI file ay Standard MIDI File, format 1. Hawak ng unang track ang tempo at 4/4 time signature, na sinusundan ng isang track bawat synth, na ipinangalan sa synth. Pinapanatili ng bawat note ang simula, haba at velocity nito. Ang synth na ang pangalan ay tumutukoy sa instrumento, tulad ng bass, strings, pad o piano, ay nagkakaroon ng katugmang General MIDI instrument, at ang pangalang parang drum ay napupunta sa channel 10. Ang tuning na hindi twelve-tone ay nira-round sa pinakamalapit na semitone na may pitch bend.

Hindi kayang hawakan ng MIDI file ang mga setting ng synth, filter, effect, bus, sample o pagkanta, kaya pinapatugtog ng DAW ang mga note gamit ang sarili nitong mga instrumento. Binabasa ang tempo mula sa mga cycle bawat segundo ng kanta, na ang isang cycle ay isang bar na may apat na beat, dahil hindi bahagi ng ibinabalik ng renderer ang sariling time signature ng kanta.

Walang mapaglalagyan ng credential ang MIDI file, kaya nasa text event sa file ang pahayag, at sinasabi ito sa iyo ng export panel. Inilalarawan ng panel ang lahat ng ito bago ka mag-export. Pagkatapos ng bawat export, muling binabasa ng editor ang na-save na file at iniuulat lang kung ano ang nakita sa pagbasang iyon.

Para sa pangkalahatang itinatala ng Content Credentials, tingnan ang [Mag-export ng file](/info/exporting.html#content-credentials-c2pa).
