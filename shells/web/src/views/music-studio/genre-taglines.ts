// SPDX-License-Identifier: MPL-2.0
/**
 * One line for each genre under its title on the music generator's genre button (#/music):
 * what you are hearing, in eight words or fewer, so someone opening a shared link or
 * shuffling knows at once what is playing and starts to learn what makes the genre.
 *
 * Each line is drawn from how the composer builds that genre (the leanings and comments in
 * engine/src/lofi-compose.ts and the genre composers beside it) and from the genre's row
 * in docs/generated-music.md. Keyed by genre id, with a plain line for an id this table
 * does not know yet, so a genre that arrives before its line still shows something true.
 * A new genre adds its line here (genre-taglines.test.ts lists any genre without one).
 */
import { t } from '../../i18n.ts';

/** Every genre's line, in the page's language. A function, so each line is read in the language showing now. */
export function genreTaglines(): Readonly<Record<string, string>> {
  return {
    warm: t('Dusty Rhodes, flute and a lazy beat'),
    lateNight: t('Slow minor felt piano and soft rimshots'),
    rainy: t('Felt piano, kalimba and brushed snare'),
    sings: t('Kalimba melodies over a bossa or shuffle'),
    sugar: t('Slap bass, saw chords and coin dings'),
    sherbert: t('Future bass with a games console inside'),
    persian: t('Tar, santur and tombak in six-eight'),
    guzheng: t('Guzheng glides, erhu, dizi and a gong'),
    koto: t('Koto, shamisen, shakuhachi and taiko'),
    kora: t('Kora, balafon and djembe in twelve-eight'),
    afrobeat: t('Horns, chopping guitar and a talking drum'),
    amapiano: t('Log drum bass, jazzy piano, swung shaker'),
    chiptune: t('An old games console’s pulse arpeggios'),
    citypop: t('Slap bass, Rhodes and Tokyo at sunset'),
    funk: t('Slap bass, wah guitar and horn lines'),
    soul: t('Walking bass, Rhodes, organ and a backbeat'),
    nudisco: t('Filtered disco, octave bass and wah guitar'),
    hiphop: t('Boom-bap, a sliding 808 and chopped keys'),
    triphop: t('A slow swung break, 808 and dark pads'),
    reggae: t('One drop beat, offbeat skank and deep bass'),
    spanish: t('Nylon guitar rumba, cajón and palmas'),
    rock: t('Crunchy power chords and a lead guitar solo'),
    metal: t('Heavy chugging guitars and a double kick'),
    country: t('Boom-chick guitar, pedal steel and fiddle'),
    blues: t('Twelve-bar shuffle, harmonica and organ'),
    jazz: t('A small combo swinging on the ride'),
    swing: t('Big band brass, clarinet and jungle toms'),
    straya: t('Didgeridoo, banjo and bush birds'),
    arnhem: t('Yidaki and clapsticks with rock and hip-hop'),
    fantasy: t('Rippling harp, bells and a lydian melody'),
    dream: t('Drifting pads, choir and long held chords'),
    kpop: t('Supersaw stabs, claps and a chanted chorus'),
    synthwave: t('Octave bass, arpeggios and a saw lead'),
    acid: t('A squelching 303 over four on the floor'),
    electro: t('Distorted bass riffs under a hard pump'),
    dubstep: t('Half-time wobble bass trading with growls'),
    brostep: t('Growling, screeching basses in heavy half-time'),
    dnb: t('Fast edited breaks under a rolling reese'),
    ska: t('Offbeat skank, walking bass and horns'),
    punk: t('Fast buzzsaw power chords and driving bass'),
    rnb: t('Lush Rhodes chords, sliding 808 and snaps'),
    grunge: t('Quiet clean verses, then loud fuzz choruses'),
    stoner: t('Slow, heavy fuzz riffs on the blues scale'),
    shoegaze: t('A wall of swaying fuzz guitars'),
    lofiHouse: t('Dusty deep house through an old sampler'),
    salsa: t('Clave, piano montuno, congas and timbales'),
    surf: t('Fast tremolo guitar in a spring reverb'),
    yacht: t('Rhodes, chorus guitar and a sax solo'),
    botanica: t('Acoustic instruments outdoors, with gentle glitches'),
    oompa: t('A Bavarian brass band, tuba on the beat'),
    noosa: t('Warm bass, coastal groove and breaking waves'),
    breakbeat: t('A chopped drum break and a rolling reese'),
    funkyHouse: t('Disco loop, Latin percussion and vocal chops'),
    ukGarage: t('Swung two-step drums, organ stabs and chops'),
    privateSchool: t('Mellow amapiano, soft log drum and sax'),
  };
}

/** The line for a genre: its own, or a plain true line for a genre this table does not know yet. */
export function genreTagline(mood: string): string {
  const lines = genreTaglines();
  return Object.hasOwn(lines, mood) ? lines[mood]! : t('Every note composed fresh from this seed');
}
