# Lolly Rondocode songs

A rondocode song is music written as code: synths, patterns and a mix, played as you type. Lolly can play a song under a video, and the **Rondocode** utility lets you write one and export it as audio. Both record the song in the file's Content Credentials, so the music says where it came from.

## Play a song in Lolly

The asset picker takes a song as a `.rondo` or `.rondo.json` file, or as a pasted `rondocode.com` share link. A song is code that makes its own sound, so it plays at whatever length its clip asks for. It can be the **music bed** under a video export or play in Neurospicy Mode's ambient player.

The song's code runs in Lolly's sandbox, with no network and no access to your files. Any part a render cannot play, such as a live microphone, or singing without the voice models, is listed in the asset's details.

From the terminal, `lolly mix` takes a song as the whole soundtrack; see [CLI rendering](/info/cli-rendering.html).

## Write and export a song

Open the **Rondocode** tool from **Utilities** to write a song in rondocode's live editor and hear it as you type. Export it as **WAV**, **MP3**, **M4A**, **Opus** or **FLAC**, as a ZIP of stems, as **MIDI**, or as a recording of what is playing. From the terminal, `lolly rondocode --export=mid` writes the same MIDI file. **Export length** sets how many seconds an audio export lasts. The song file itself (`.rondo.json`) is your code as written and carries nothing added.

A song can sing its lyrics with `sing()`. The singing is made on your device by downloaded voice models, and a file that holds synthesised singing always declares the singing as AI-generated (see [AI features](/info/ai-features.html)).

## Songs in the credential

A video or audio export that plays a rondocode song records each song in its Content Credentials as a source:

- the song's name;
- the SHA-256 of its `.rondo.json` file;
- how it was rendered: in Lolly's sandbox, the `vm` execution class, with the renderer's version and seed, and any part the render could not play.

Music computed from a song's code is marked as algorithmic media, so Lolly Verify does not flag it as AI. Before you export, a line under **Download** lists the songs the credential will record; after the export, the same line reports what a reading of the delivered file found. Untick **C2PA Credentials** to leave the record out. A still image records no song, because it carries no sound. `lolly mix` and the [MCP server](/info/mcp.html) write the same record.

## Files from the Rondocode utility

Most on-device utilities write no credential, because they transform a file you already own. Lolly Rondocode makes new audio, so every audio file it writes carries Content Credentials that record the song as its source: its name, the SHA-256 of its `.rondo.json` file and where its code ran. That covers WAV, MP3, M4A, Opus, FLAC, each stem in a stems ZIP and a recording of what is playing.

- The editor's own renders run in its private frame (the `frame` execution class) and record the editor's version.
- A render made by the CLI or a share link runs in the `vm` class and records the renderer's version and seed.
- A WAV also states the same in its RIFF comment.
- Music computed from the song's code is algorithmic media and is not marked as AI.

When a song sings, the file declares that singing AI-generated in a machine-readable form. The credential's digital source type is composite media made with trained models, the record lists the sung parts, and one C2PA AI disclosure per model identifies each model the singing passed through: Supertonic-3 text to speech, the wav2vec 2.0 phoneme aligner, the ContentVec encoder and the RVC voice, with the repository and commit Lolly hosts it from. A file that holds synthesised singing is never saved without that declaration.

### What the MIDI file holds

The MIDI file is a Standard MIDI File, format 1. The first track holds the tempo and a 4/4 time signature, and there is one track after it for each synth, named for the synth. Each note keeps its start, length and velocity. A synth whose name reads as an instrument, such as a bass, strings, a pad or a piano, gets the matching General MIDI instrument, and a drum-like name goes on channel 10. A tuning that is not twelve-tone is rounded to the nearest semitone with a pitch bend.

A MIDI file cannot hold how a song sounds. The synth settings, filters, effects, buses, samples and singing are not in it, so a DAW plays the notes with its own instruments. The tempo is read from the song's cycles per second with one cycle as a bar of four beats, because the song's own time signature is not part of what the renderer hands back.

A MIDI file has no place for a credential, so a text event in the file carries the statement instead, and the export panel tells you so. The panel describes all of this before you export, and after each export the editor reads the saved file back and reports only what that reading found.

For what Content Credentials record in general, see [Export a file](/info/exporting.html#content-credentials-c2pa).
