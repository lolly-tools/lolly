# Music generator

The music generator makes a track of your own in any of Lolly's genres, from lofi and jazz to synthwave and drum and bass. Pick a genre, shuffle until you like what plays, change any instrument you like, then download an M4A or WAV file. Every note is composed on your device: no samples, no recordings and no generative AI.

Music you make here is free for any use, including commercial use, as long as you credit Lolly with the line **Music made with Lolly**. [Use your music](#use-your-music) explains how to credit a track.

Open **Music generator** from **Utilities**, or go straight to [the music generator](/#/music). Want to hear the genres first? [Free background music](/info/background-music.html) has a short sample of every genre to play.

![The music generator playing a Sugar track: the bar of controls along the top, the Tune and Mix sections, then the track itself, with the sections along the top and a lane each for Melody, Chords, Bass, Drums and Ear candy, every note drawn](/t/url-shot?url=%2F%23%2Fmusic%3Fstyle%3Dsugar%26seed%3D7%26bars%3D64&width=1440&height=900&dpi=192&waitMs=3200&walker=1&format=svg&dark=1&filename=music-studio)

<!--i:eti-sparkles-->
## Make a track in four steps

::: steps
- <!--i:eti-sparkles--> **Pick a start** Choose a genre and a seed, or press shuffle for both. Set the key and the tempo if you like.
- <!--i:eti-layers--> **Change instruments by section** Click a section in a lane, hear the instruments in that section and use one there or all through the track.
- <!--i:eti-sliders--> **Mix the parts** Set each part's level, the effects, the room and the drive.
- <!--i:eti-download--> **Keep the track** Download an M4A or WAV file, save the tune to your assets, or copy a link.
:::

<!--i:eti-monitor-->
## The studio at a glance

From the top down:

- **The bar.** Play and the time, the seed, shuffle, the genre padlock and the genre button, then undo and redo, **Render**, **Save** and the link.
- **Tune.** The length, the key, the tempo and **Reset**. The section's heading shows the length, key and tempo while it is closed.
- **Mix.** A level for each part, the room, the texture, the brightness and the drive, and the ear candy switches.
- **The visualiser.** A band that shows while something plays.
- **The track.** The sections and chords along the top, then a lane for each part with every note drawn. Each section is named for its genre: a band's drop is its chorus and its break the solo.

![The bar of controls: play and the time, the seed with its arrows, the round shuffle button, the genre padlock, the Sugar genre button with its line "Slap bass, saw chords and coin dings", then undo, redo, Render, Save and the link button](/t/url-shot?url=%2F%23%2Fmusic%3Fstyle%3Dsugar%26seed%3D7%26bars%3D64&width=900&height=900&dpi=192&waitMs=3200&cropSelector=.ms-bar&walker=1&format=svg&dark=1&filename=music-bar)

<!--i:eti-music-->
## Choose a genre

The genre button shows the genre playing: its icon, its name and a line of what you are hearing (Straya's reads "Didgeridoo, banjo and bush birds"), on the genre's own colours. Click the button to see every genre as a card, A to Z in six groups: **Chill** (the Lofi moods among them), **Rock & Roots**, **Soul & Groove**, **Club**, **Bass & Synth** and **World**. A **Recent** row at the top holds the last six genres you played.

Type in the search field to narrow the cards ("house" finds Lofi house and Funky house), then click a card, or move to one with the arrow keys and press Enter. Escape clears the search, then closes the picker.

<!-- A screenshot of the genre picker goes here once its redesign merges (feat/music-studio-motion).
Recipe to add then, with the leading "!" and the alt text:
[The genre picker: the Recent row, then the six groups of genre cards, each in its own colours](/t/url-shot?url=%2F%23%2Fmusic%3Fstyle%3Dsugar%26seed%3D7%26bars%3D64&width=1440&height=900&dpi=192&waitMs=3200&drive=click%3A%5Bdata-genre%5D%3Bwait%3A600&walker=1&format=svg&dark=1&filename=music-genre-picker)
-->

<!--i:eti-repeat-->
## Shuffle, the seed and the padlock

Every tune comes from its genre and a **seed**, a whole number. The same genre and seed always make the same tune, on any device, so a seed is all you need to find a tune again.

- **Shuffle**, the round button with the crossing arrows, draws a new genre, a new seed and a sound to suit them. Hold Shift as you press it to keep the genre, the seed and the key and change only the sound.
- **The seed.** Type a number, step with the arrows, or drag across the number to slide through seeds and hear the tune change.
- **The padlock** between shuffle and the genre button decides whether shuffle may change the genre. Open, shuffle draws any genre. Closed, shuffle stays in the genre you chose and draws a new seed and sound. Your choice is kept with your profile.

A closed padlock travels in a link as `lock=genre`. Whoever opens that link shuffles within the same genre until they open the padlock, which is how the **Make your own** buttons on the [genre pages](/info/background-music.html) keep you in the genre you came for.

<!--i:eti-layers-->
## The tracks

Each lane is one part of the tune:

| Track | What it plays |
|---|---|
| **Melody** | The tune itself |
| **Chords** | Keys, guitars, strings, harps or saw chords |
| **Bass** | The bass line |
| **Drums** | The kit, from acoustic and jazz kits to 808s |
| **Ear candy** | The sounds laid over the tune: birds, waves, shouts, the Lolly tag, a games console, sparkles and sweeps |

![The track heads: Melody, Chords, Bass, Drums and Ear candy, each with the instrument playing (Auto with the composer's choice), then mute and solo](/t/url-shot?url=%2F%23%2Fmusic%3Fstyle%3Dsugar%26seed%3D7%26bars%3D64&width=1440&height=900&dpi=192&waitMs=3200&cropSelector=.ms-heads&walker=1&format=svg&dark=1&filename=music-track-heads)

- **Mute and solo.** Each track's head has mute (the speaker) and solo (the headphones). Soloed tracks play alone.
- **Who chose the instrument.** A head reads **Auto** and the instrument's name when the composer chose the instrument (**Auto · Slap bass**), and the name alone when you did. Where a part changes instrument, a line runs down the lane and a chip shows the new instrument: filled when you chose the instrument, tinted when the composer did.
- **Choose an instrument.** Click a track's head, or a section in its lane, to open the instrument browser. Click a card to hear two bars of this tune's part on that instrument. **Use here** plays the instrument in every section of that kind (the bass in every chorus), and **Use everywhere** plays the instrument all through the track. **Auto** goes back to the composer's choice. The drums' browser holds the kits. A kit changes how the drums sound, never which notes they play.
- **Favourites and blocks.** A star on a card makes an instrument a favourite, which shuffle draws more often. Block an instrument to keep it out of shuffles and new tunes.

<!-- A screenshot of the instrument browser goes here once its redesign merges (feat/music-studio-motion).
Recipe to add then, with the leading "!" and the alt text:
[The instrument browser for the bass: a card for each instrument, grouped by family, with Use here and Use everywhere](/t/url-shot?url=%2F%23%2Fmusic%3Fstyle%3Dsugar%26seed%3D7%26bars%3D64&width=1440&height=900&dpi=192&waitMs=3200&drive=click%3A.ms-heads%20%5Bdata-browse%3D%22bass%22%5D%3Bwait%3A800&walker=1&format=svg&dark=1&filename=music-instrument-browser)
-->

<!--i:eti-sliders-->
## Tune

**Tune** sets the track's length, key and tempo.

![The Tune section open: 64 bars, the key menu, the tempo in beats a minute and Reset](/t/url-shot?url=%2F%23%2Fmusic%3Fstyle%3Dsugar%26seed%3D7%26bars%3D64&width=900&height=900&dpi=192&waitMs=3200&drive=click%3A%5Bdata-sec%3D%22tune%22%5D%20summary%3Bwait%3A400&cropSelector=%5Bdata-sec%3D%22tune%22%5D&walker=1&format=svg&dark=1&filename=music-tune)

- **Length.** A track ends the way a song does. Where the length you chose falls partway through a tune, the tune is cut at the end of a phrase and finished with its own outro and fade, so the track can come out a little longer or shorter than you asked.
- **Key.** Move the whole tune up to six semitones up or down. Every pitched part moves together and the drums stay as they are.
- **Tempo.** Each tune plays at its own tempo until you type another or drag across the field. The notes stay where they are in the bar, so the tune only plays faster or slower. The arrow beside the field goes back to the tune's own tempo.
- **Reset** keeps the genre and the seed and puts everything else back: 64 bars, every part automatic, the tune's own key and tempo, every level as designed, and nothing muted or soloed.

<!--i:eti-volume-->
## Mix

**Mix** holds a level for each part, the room, the texture (from a clean record to a dusty one), the brightness and the drive. Each is a pill with its name and value: press or drag along the pill to set the level, or use the arrow keys.

![The Mix section open: pills for Melody, Chords, Bass, Drums, Ear candy and Room, then Texture, Brightness and Drive, then the ear candy row with the Lolly tag menu and the Voices, Console, Sparkles, Sweeps, Aussie birds and Waves switches](/t/url-shot?url=%2F%23%2Fmusic%3Fstyle%3Dsugar%26seed%3D7%26bars%3D64&width=900&height=900&dpi=192&waitMs=3200&drive=click%3A%5Bdata-sec%3D%22mix%22%5D%20summary%3Bwait%3A400&cropSelector=%5Bdata-sec%3D%22mix%22%5D&walker=1&format=svg&dark=1&filename=music-mix)

The ear candy row turns kinds of sound on and off: **Voices** (the shouts and the Lolly tag), **Console** (a games console's sounds), **Sparkles**, **Sweeps**, **Aussie birds** and **Waves**. In a genre with birds of its own, such as Straya or Noosacore, **Aussie birds** turns them off; in any other genre the switch brings in a magpie and a kookaburra now and then. **Waves** works the same way with the sea. The menu beside the switches chooses how a tune says "Lolly": as the composer placed the tag, not at all, or one way every time (spoken, sung, whispered, shouted, as a robot and more).

<!--i:eti-bird-->
## Ear candy moments

Each sound on the Ear candy lane shows as a small icon where it comes in: a bird, a wave, a games console, a riser or a sweep, a shout or the Lolly tag, sparkles, or the sounds of a place. Point at an icon to see its name.

- **While the track is stopped**, press an icon to hear that moment on its own, with every other part turned off.
- **While the track plays**, press an icon and the music carries on from that moment's bar.
- **With the keyboard**, the icons are one stop for Tab, and the arrow keys move from moment to moment through the whole track.

![The track with a pointer resting on one Ear candy icon: under the drum hits, a row of small icons (games consoles, coins and risers) sits where each sound comes in, and the icon pointed at shows its name, Shout](/t/url-shot?url=%2F%23%2Fmusic%3Fstyle%3Dsugar%26seed%3D7%26bars%3D64&width=1440&height=900&dpi=192&waitMs=3200&drive=hover%3A.ms-fx-moment%20%3E%3E%20nth%3D6%3Bwait%3A300&cropSelector=.ms-editor&walker=1&format=svg&dark=1&filename=music-ear-candy)

<!--i:eti-sun-->
## The visualiser

While a tune plays, or is stopped part way, a band above the track shows a spectrum analyser in the colour of the section playing. The settings button in its corner switches to a waveform, MilkDrop or nothing. **Expand** grows the band in the page and **Full screen** gives the band the whole screen, where MilkDrop plays with its presets, a preset shuffle and a preset cycle. If you prefer reduced motion, both open on the analyser instead and MilkDrop waits until you choose MilkDrop. Escape leaves full screen, then shrinks the band.

![The visualiser band above the track while a Sugar track plays: a spectrum analyser in the colour of the section playing, with its settings, expand and full screen buttons in the corner](/t/url-shot?url=%2F%23%2Fmusic%3Fstyle%3Dsugar%26seed%3D7%26bars%3D64&width=900&height=900&dpi=192&waitMs=3200&drive=click%3A%5Bdata-play%5D%3Bwait%3A2500&cropSelector=%5Bdata-viz-stage%5D&walker=1&format=svg&dark=1&filename=music-visualiser)

<!--i:eti-download-->
## Render, save and share

**Play** plays the track live, as fast as your device can work it out. **Render** works the whole track out at full quality first, with denser cymbals and more detail than live playing can afford, and offers three choices:

![Render's choices: Render and play, Download M4A and Download WAV, with the line saying what every download records](/t/url-shot?url=%2F%23%2Fmusic%3Fstyle%3Dsugar%26seed%3D7%26bars%3D64&width=1440&height=900&dpi=192&waitMs=3200&drive=click%3A%5Bdata-render%5D%3Bwait%3A500&cropSelector=.ms-choice-menu&walker=1&format=svg&dark=1&filename=music-render-menu)

- **Render and play** plays the full-quality render.
- **Download M4A** saves a small AAC file, for video editors, phones and the web.
- **Download WAV** saves an uncompressed file, for editing or mastering.

A render can take longer than the track itself, and a card shows how far it has got. Cancel or Escape stops the render. Once rendered, the button reads **Rendered** and each choice happens at once. A change to the track goes back to live playing until you render again.

**Save** keeps the track without rendering:

![Save's two places: Save to assets and Save to projects, each with a line saying what it keeps](/t/url-shot?url=%2F%23%2Fmusic%3Fstyle%3Dsugar%26seed%3D7%26bars%3D64&width=1440&height=900&dpi=192&waitMs=3200&drive=click%3A%5Bdata-save%5D%3Bwait%3A500&cropSelector=.ms-choice-menu&walker=1&format=svg&dark=1&filename=music-save-menu)

- **Save to assets** keeps the track as a tune: a few hundred bytes holding everything the track was made with. A saved tune plays in Assets and in the Neurospicy player, and you can pick the tune as a video's music bed (the tune loops to fill a longer video) or an audiogram's sound.
- **Save to projects** keeps every setting, so the track opens back in the music generator as you left the track.

**The link button** copies a link holding every setting. Anyone who opens the link hears the same track and can change the track for themselves.

<!--i:eti-history-->
## Undo and redo

Every change can be taken back: the genre, the seed, a shuffle, an instrument, mute and solo, a level, the tempo, the key, the length, the ear candy switches and **Reset**. Use the arrows beside **Render**, or press Cmd or Ctrl+Z to undo and Shift+Cmd or Ctrl+Z (or Ctrl+Y) to redo. A slider dragged counts as one step, however far you drag the slider. A playing track keeps playing, and the line under the track tells you what was undone or redone.

<!--i:eti-badge-check-->
## Content Credentials

Every M4A or WAV you download carries Content Credentials: a signed record inside the file. The record says the track was made with Lolly's music generator, procedurally and with no AI, and gives the genre and the seed. Its digital source type is algorithmic media, the IPTC term for media computed by an algorithm with no recordings or trained models, so a checker such as [Lolly Verify](/#/verify) does not flag the track as AI. The record carries no name, and the same sentence is also the file's plain description, which a music player shows.

To share a file without the record, run the file through the [Lolly Strip Hidden Data](/t/strip-data) utility. [What a track records](/info/generated-music.html#what-a-track-records) lists everything each kind of file and saved tune keeps.

<!--i:eti-award-->
## Use your music

<a id="free-with-credit"></a>

Music you make in the music generator is free for any use, including commercial use, provided you credit Lolly. Use this line wherever your credits go:

> **Music made with Lolly**

When there is room for a link, add the address: **Music made with Lolly (https://lolly.tools)**.

- **A video or a YouTube upload:** in the description or the end credits.
- **A podcast:** in the show notes.
- **A live stream:** in the description or on a panel.
- **A game or an app:** on the credits screen.
- **A presentation or an event:** on the last slide or in the programme.

Looking for copyright-free background music? Music made here is not copyright-free, because the credit is a condition of using the music. The music is free to use, even commercially, and royalty-free as long as you include the credit.

<!--i:eti-keyboard-->
## Keyboard and phone

- Space plays and stops. Click the top row to play from a section, or double-click a bar to play from that bar.
- Escape closes the instrument browser or a panel, then leaves the generator.
- Zoom in, zoom out or fit the whole track with the buttons above the track heads.

On a phone, play, the time, the seed and shuffle sit along the bottom of the screen, and each track is a row showing its instruments, mute and solo. Tap a row to choose its instruments.

![The music generator on a phone: the genre button and the padlock across the top, Render and Save below them, the Tune, Mix and Tracks sections, and play, the seed and shuffle along the bottom](/t/url-shot?url=%2F%23%2Fmusic%3Fstyle%3Dsugar%26seed%3D7%26bars%3D64&width=390&height=844&dpi=192&waitMs=3200&css=.ms-track%20.ms-browse%20%5Bdata-short%5D%7Bdisplay%3Anone%7D&walker=1&format=svg&dark=1&filename=music-phone)

<!--i:eti-info-->
## How the music is made

[Generated music](/info/generated-music.html) explains how a seed becomes a tune, what stays the same between devices, how each genre's instruments are built and measured, and what every file and saved tune records.
