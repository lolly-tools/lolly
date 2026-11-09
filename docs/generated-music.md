# Generated music

The Neurospicy player makes its own music. Its generated stations, all in the **Lolly Sings** group, compose every tune as they play: the original Lolly Sings, Sugar, Sherbert, K-pop, Straya, Persian, Guzheng, Koto, Kora, Afrobeat, Amapiano, Chiptune, City pop, Funk, Soul, Nu-disco, Hip hop, Trip hop, Reggae, Spanish guitar, Rock, Metal, Country, Blues, Jazz, Swing, Fantasy, Dreamscape, Synthwave, Acid, Electro, Dubstep, Brostep and D&B, and the three **Lofi** moods (Warm, Late night and Rainy). Nothing is recorded or sampled. Each tune is written by Lolly's composer and played by instruments synthesised in your browser.

## Every tune is a number

A tune comes from two things: its station and a **seed**, a whole number from 0 to 4,294,967,295. The composer turns the station and the seed into the same tune every time, on every device: the same key and tempo, the same instruments, the same groove and running order, and every note in the same place. It reads no clock, rolls no dice of its own and fetches nothing from the internet, so there is nothing else for a tune to depend on.

That is what makes the music deterministic, and everything below follows from that rule:

- **A shared link plays the same tune.** **Share this tune** copies a link such as `#/?lofi=sugar.2024`. Whoever opens the link hears the tune you heard.
- **A saved tune is a few bytes.** **Save to library** keeps the station and the seed as an asset in your library, about 70 bytes, not a recording. Playing the tune later composes the same music again.
- **A music bed renders the same audio.** A saved tune used as a video's music bed is rendered from the seed when the video is made, repeating to fill the video.
- **Next and Previous move between seeds.** Next starts a new tune with a fresh seed. Previous goes back to the seed before, so a tune you skipped past is never lost.

## What stays the same, and what can differ

| Stays the same for everyone | Can differ |
|---|---|
| The notes, their timing and their loudness | Your **Drums** and **Texture** settings, applied on top of the tune |
| The instruments, the tempo and the key | Your volume, your speakers and your headphones |
| The running order: intro, verses, builds, drops and the ending | How an instrument sounds after a Lolly update that improves that instrument |
| | A percussion part (a shaker, a tambourine, congas) that an update adds to a genre; the other parts keep their notes |
| | New sounds a genre gains: Dubstep, Brostep and D&B now end each phrase of a drop with the bass talking, which takes over the second half of that bar's bass line, and add bleeps and phaser sweeps around the rest |

A Lolly update can change how an instrument is synthesised, to fix a harsh sound or balance a mix. The tune keeps its notes, so a shared link still plays the same piece. New stations are written so that existing tunes do not change, and a genre that gains new parts says so in the table above. Lolly's tests pin known seeds to the tunes they compose, so an update that would rewrite an existing tune by accident is caught before release.

## How a tune is made

Each station leans the composer towards its genre without fixing the outcome. The instruments of Persian, Guzheng, Koto, Kora and Amapiano follow published acoustics and openly licensed instrument models: plucked and struck strings shaped by where they are played, bars and drumheads as their measured modes (the balafon's from the Synthesis ToolKit's wood bar), breathy flutes and bowed strings through their bodies' resonances, and the log drum after the MIT-licensed mda DX10's preset of that name. A Persian dastgah's koron is played a quarter-tone flat, a close approximation of the neutral steps musicians play. Sherbert was tuned by measuring three Australian future-bass records of the mid-2010s for tempo, groove, stereo width and tonal balance (134 to 145 beats a minute, half-time, chords as wide as the speakers over a mono sub bass); it copies none of their notes or sounds.

1. **A style.** The seed picks the instruments (keys, lead, bass and drum kit), how the drums are tuned, the groove, how often the chords change, and how much tape wobble and room the tune gets.
2. **Harmony and melody.** The tune draws two chord progressions in its key, voices each chord close to the last, and writes a short melody and its answer from the key's pentatonic scale, with a chord tone on each strong beat.
3. **A running order.** Instruments enter, take the front and drop out at different moments in each tune. The Lolly Sings dance genres build tension with a roll and a riser, open the drop on a crash, and change instruments between sections, with softer keys in the quiet parts and a second lead and bass in the second drop. The band genres play songs: verses, a pre-chorus that turns into the chorus with a fill round the toms, a solo and a last chorus. Blues plays twelve-bar choruses with the turnaround as its intro, and Jazz and Swing trade four bars with the drummer.
4. **Sound.** Your browser plays the notes with oscillators, filters and noise. The slap bass in Sugar is shaped by frequency modulation, so it can be thumbed, popped, slid and bent. The horns brighten as they get louder, as real horns do, with breath that buzzes at the note's pitch. The cymbals ring with metal rather than hiss, and each genre has its own hand percussion.

### The genres' instruments

| Genre | What you hear |
|---|---|
| Sherbert | Future bass with an old games console inside: fast and half-time, with the clap on three. Wide saw chords pump under the kick, bend up into their pitch and wub. Chopped vowels sing the hook in leaps over an 808. Hats roll in sixteenths and thirty-seconds. A console's chord arpeggios sparkle, with coins, jumps, bounces, blips, lasers and power-ups between phrases, and a crowd calls hey, yeah, woo, oh and ayy. Each build's roll climbs an octave and ends on a chopped stutter or a power-up |
| Persian | A tar strumming the drone in six-eight, a santur's hammered runs and tremolos, a ney or a kamancheh singing in a dastgah (Shur, Homayoun, Chahargah, Mahur or Esfahan), the tombak's tom and bak with finger rolls, and the daf's boom and rings |
| Guzheng | A Chinese zither's flowing arpeggios and glissandi in a pentatonic mode, an erhu, a dizi with its buzzing membrane, a pipa or the guzheng itself pressing up into its notes, a woodblock, the tanggu's big drum and a gong |
| Koto | The koto and the shamisen in the in, yo or Ryukyu scale, a breathy shakuhachi bending its notes, the taiko's don and ka, and the kotsuzumi's calls |
| Kora | The kora's ostinato in twelve-eight under its own running lines in one of its tunings (sauta, silaba or tomora), a buzzing balafon, the djembe's bass, tone and slap over the dunun and its bell, and a shekere |
| Afrobeat | A long groove: horns, an organ, a guitar chopping sixteenths, a bass riff that never lets go, a busy kit with a shekere and an agogo bell, and a talking drum answering at the end of each phrase |
| Amapiano | The log drum's woody, sliding bass, jazzy piano chords on the offbeats, a swung shaker, a soft four on the floor, and a flute, sax or soft lead floating over |
| Dubstep, Brostep and D&B | The bass talks at the end of each phrase of a drop: a bwah flung open, a yoi from oh to ee, a throaty growl or a deep, round wub. FM bleeps sit in the gaps, and phaser sweeps rise through the builds and zip at the turns |
| Straya | A banjo picking rolls over a yidaki drone on the key note (pulsed by the breath, with toots, barks, the in-breath of circular breathing and a howl), an acoustic strum, a stomp and clap, clapsticks, magpies carolling between the phrases and now and then a kookaburra |
| Country | An acoustic guitar's boom-chick or a honky-tonk piano, the train beat on the snare or brushes, a bass walking root to fifth, and a twanging guitar, pedal steel, fiddle or harmonica |
| Blues | A slow shuffle in twelve-bar choruses: a harmonica, an overdriven guitar or a sax answering its own call, an organ or a barrelhouse piano, a walking or boogie bass |
| Jazz | A combo swinging on the ride: piano or archtop guitar comping, a walking upright bass, and sax, trumpet or vibes on the tune |
| Swing | The big band: brass section stabs, a clarinet, trumpet or sax lead, a feathered kick, and floor toms in a jungle intro |
| K-pop | Supersaw stabs and bright plucks, a pulse or chip lead, a synth bass or 808, claps on every beat and a chant in the chorus, and the last chorus a key higher |
| Metal | A band with power-chord chugs, a metal or overdriven lead, a double kick and crashes through the chorus, toms to turn it, and a phrygian melody |
| Fantasy | A harp rippling under a flute, bells or a choir, a lydian melody, a half-time pulse with toms, and a big room |
| Dreamscape | Pads and a choir, a soft lead, chords held two bars, a slow beat with the hats on the beat, and a long room |

## The music generator

**Music generator** (under Utilities, `#/music`, or **Open in the music generator** in the player's controls while a generated station plays) is a track editor for the same stations. One row of controls holds play, the style, the seed, shuffle, the length, the key and the tempo. Below it are a visualiser and the track itself, laid out like a sequence editor: the sections and chords along the top, a lane for the lead, keys, bass, drums and effects, and every note drawn. Each section is named for its genre: a band's drop is its chorus, its break the solo.

- **The seed.** Type any seed, step with the arrows, choose **Surprise me** for a new one, or drag across the number to slide through seeds and watch the tune change.
- **Shuffle.** The shuffle button draws a new style, seed, instruments and mix at once: each part keeps the composer's instrument half the time and takes any instrument at all the other half. Hold Shift to keep the style, the seed and the key, and shuffle only the instruments and the mix.
- **The key.** The key menu moves the whole tune up to six semitones up or down, and lists each key by name. Every pitched part moves together and the drums stay as they are.
- **The tempo.** Each tune plays at its own tempo until you set one: type a number of beats a minute in the tempo field, or drag across the field. The notes stay where they are in the bar, so the tune plays faster or slower and nothing else changes. The arrow next to the tempo field returns to the tune's own tempo. The player always plays a station at the tune's own tempo.
- **Instruments.** Each instrument draws its notes in its own shade of the part's colour. Where a part changes instrument, a line of the new shade runs down the lane, and a chip shows the instrument's family icon and its name. The chip is filled when you chose the instrument and tinted when the composer did. Each lane's head shows the instrument playing at the playhead. A track's own menu sets its instrument for the whole track. Click a section in a lane to change that part in every section of that kind: the bass in every chorus, the lead in every solo, or the drums' snare and cymbals in every pre-chorus. Nothing else about the tune changes.
- **Playing.** Click the top row to play from a section, double-click a bar to play from that bar, and press space to play or stop. Zoom in, zoom out or fit the whole track; a wide screen shows more of the track.
- **Sound and mix.** The sliders button opens the levels of each part, the effects (the risers, the console's sounds, the shouts, the birds, the sparkles, phasers and bleeps), the room, the texture, the brightness and the drive. The effects lane has its own mute and solo.
- **Keeping a track.** **Save to library** keeps the track as a tune: a few hundred bytes holding everything it was made with (its style and seed, instruments, tempo, key, mix and length), saved at once with nothing to render first. The tune plays in the Neurospicy player beside your own audio and in Assets with a player, and you can pick it as an audiogram's sound or a video's music bed (it loops to fill a longer video), always exactly as you made the track. **Make the track** renders it with progress, scheduling its notes a few seconds ahead as it goes, then **Download** saves an M4A or WAV file. Every setting is in the link, so the link button copies a track that anyone can open, play and change.

Escape closes a picker or a panel, then leaves the generator.

## Performance

The dance stations play many more synthesised voices at once than the Lofi stations. On those stations the player offers **Light visualiser**, which shows the simple level bars instead of the full visualiser so the music has the processing time it needs. The setting is on by default on a modest device, such as a phone or a computer with four cores or fewer, and you can change it in the station's controls at any time.

## No samples, no recorded voices

Every sound is synthesised by Lolly's own code. A generated tune contains no samples, loops or recordings, and no recorded voice. The vocal sounds are built from the same oscillators and filters as every other instrument: the "hey" shout in Sugar, Reggae and K-pop; Sherbert's shouts (hey, yeah, woo, oh, ayy and uh); and Sherbert's chopped vowels, which sing ah, eh, ee, oh and oo with no words. The magpies and the kookaburra are synthesised the same way.
