# Generated music

The Neurospicy player makes its own music. Its generated stations, all in the **Lolly Sings** group, compose every tune as they play: the original Lolly Sings, Sugar, Hip hop, Reggae, Spanish guitar, Rock, Synthwave, Electro, Dubstep, Brostep and D&B, and the three **Lofi** moods (Warm, Late night and Rainy). Nothing is recorded or sampled. Each tune is written by Lolly's composer and played by instruments synthesised in your browser.

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

A Lolly update can change how an instrument is synthesised, to fix a harsh sound or balance a mix. The tune keeps its notes, so a shared link still plays the same piece. New stations are written so that existing tunes do not change. Lolly's tests pin known seeds to the tunes they compose, so an update that would rewrite an existing tune is caught before release.

## How a tune is made

Each station leans the composer towards its genre without fixing the outcome:

1. **A style.** The seed picks the instruments (keys, lead, bass and drum kit), how the drums are tuned, the groove, how often the chords change, and how much tape wobble and room the tune gets.
2. **Harmony and melody.** The tune draws two chord progressions in its key, voices each chord close to the last, and writes a short melody and its answer from the key's pentatonic scale, with a chord tone on each strong beat.
3. **A running order.** Instruments enter, take the front and drop out at different moments in each tune. The Lolly Sings dance genres build tension with a roll and a riser, open the drop on a crash, and change instruments between sections, with softer keys in the quiet parts and a second lead and bass in the second drop.
4. **Sound.** Your browser plays the notes with oscillators, filters and noise. The slap bass in Sugar, for example, is a modelled string that can be thumbed, popped, slid and bent.

## Performance

The dance stations play many more synthesised voices at once than the Lofi stations. On those stations the player offers **Light visualiser**, which shows the simple level bars instead of the full visualiser so the music has the processing time it needs. The setting is on by default on a modest device, such as a phone or a computer with four cores or fewer, and you can change it in the station's controls at any time.

## No samples, no recorded voices

Every sound is synthesised by Lolly's own code. A generated tune contains no samples, loops or recordings, and no recorded voice. The one vocal sound is the "hey" shout in Sugar and Reggae, which is built from the same oscillators and filters as every other instrument, and it says nothing else.
